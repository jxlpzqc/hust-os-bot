import Imap from 'imap';
import { log, logError } from '@/log'
import { getSecrets } from '@/config';

const CC_EMAIL = process.env.CC_EMAIL || "hust-os-kernel-patches@googlegroups.com";

export type MessageItem = {
  seqno: number;
  headers: {
    [index: string]: string[]
  };
}

function getAllEmails(username: string, password: string): Promise<MessageItem[]> {
  const list: MessageItem[] = [];
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: username,
      password: password,
      host: "mail.hust.edu.cn",
      port: 993,
      tls: true,
    });

    imap.on("ready", () => {
      imap.openBox("INBOX", (err, mailbox) => {
        if (!err) {
          const total = mailbox.messages.total;
          var f = imap.seq.fetch(`1:${total}`, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO CC)',
          });
          f.on('message', function (msg, seqno) {
            msg.on('body', function (stream, _) {
              var buffer = '';
              stream.on('data', function (chunk) {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', function () {
                list.push({
                  seqno,
                  headers: Imap.parseHeader(buffer)
                });
              });
            });
          });
          f.once('error', function (err) {
            logError('Fetch error: ' + err);
            reject(err);
          });
          f.once('end', function () {
            log(`Done fetching all messages! ${total} messages fetched.`);
            imap.end();
            resolve(list);
          });
        };
      });
    });
    imap.connect();
  })
}


function getThreadInfo(msgs: MessageItem[]): {
  parent: number[],
  isLast: boolean[]
} {
  const isFirst = (msg: MessageItem) => !msg.headers["in-reply-to"];
  const mid = (msg: MessageItem) => msg.headers?.["message-id"]?.[0];
  const pid = (msg: MessageItem) => msg.headers?.["in-reply-to"]?.[0] || "";

  const parent = new Array<number>(msgs.length);
  const isLast = new Array<boolean>(msgs.length).fill(true);
  const hash = new Map<string, number>();

  for (let i = 0; i < msgs.length; i++) {
    if (mid(msgs[i])) hash.set(mid(msgs[i]), i);
  }

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];

    if (isFirst(msg)) {
      parent[i] = -1;
    }
    else {
      parent[i] = hash.get(pid(msg)) || -1;
      if (parent[i] != -1) isLast[parent[i]] = false;
    }
  }

  return {
    parent,
    isLast
  };
}

function getEmailAddress(str: string): string {
  const reg = /^.+<(.+?)>$/;
  if (reg.test(str)) {
    return reg.exec(str)?.[1] || str;
  }
  return str;
}

function filterRecentEmails(items: MessageItem[]): MessageItem[] {
  return items.filter(u => {
    if (u.headers["date"] && u.headers["date"][0]) {
      const d = new Date(u.headers["date"][0]);
      d.setDate(d.getDate() + 7);
      if (d > new Date()) {
        return true;
      }
    }
    return false;
  });
}

function filterInterstingEmails(msgs: MessageItem[], reviewerEmails: string[]): MessageItem[] {
  const ret = new Map<string, MessageItem>();

  const { parent, isLast } = getThreadInfo(msgs);
  const getRoot = (ind: number) => {
    const MAX_STACK = 200;
    let root = ind;
    let i = 0;
    while (parent[root] != -1 && i < MAX_STACK) {
      root = parent[root];
      ++i;
    }
    return msgs[root];
  };

  const isInInternalList = (ccStr: string) => {
    const ccs = ccStr.split(',');
    return ccs.findIndex(u => getEmailAddress(u) == CC_EMAIL) != -1;
  }

  const isInKernel = (ccStr: string) => {
    const ccs = ccStr.split(',');
    return ccs.findIndex(u => getEmailAddress(u).indexOf("kernel.org") != -1) != -1;
  }

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (!isLast[i]) continue;

    const isFromWeb = getEmailAddress(msg.headers["from"][0]) == CC_EMAIL;
    if (isFromWeb) continue;

    const isInternal = (msg.headers["to"] && msg.headers["to"][0]
      && isInInternalList(msg.headers["to"][0])) ||
      (msg.headers["cc"] && msg.headers["cc"][0]
        && isInInternalList(msg.headers["cc"][0])
        && !isInKernel(msg.headers["cc"][0]));

    const isUnreply = !reviewerEmails.find(u => getEmailAddress(msg.headers["from"][0]) == u);

    const from = getRoot(i).headers["from"][0];

    if (isInternal && isUnreply) {
      ret.set(from, msg);
    }
    else if (!isUnreply) {
      ret.delete(from);
    }
  }

  const retu = Array.from(ret).map(u => u[1]).sort((a, b) => a.seqno - b.seqno);
  return filterRecentEmails(retu);
}

/** Get Intersted Emails, i.e. from os kernel groups and
  * not replied by internal reviewer.
  */
export async function getInterestingEmails(): Promise<MessageItem[]> {
  const { username, password, reviewerEmails } = await getSecrets();
  const allMessages = await getAllEmails(username, password);
  const interestingEmails = filterInterstingEmails(allMessages, reviewerEmails);
  // log(inspect(interestingEmails, false, null, process.stdout.isTTY));
  log(`${interestingEmails.length} messages are found intersting.`);
  return interestingEmails;
}

