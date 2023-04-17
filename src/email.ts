import Imap from 'imap';
import { readFile } from 'fs/promises'
import { log, logError } from './log'
import { CONFIG_FILE } from '.';
import { inspect } from 'util';

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
          f.on('message', function(msg, seqno) {
            msg.on('body', function(stream, _) {
              var buffer = '';
              stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', function() {
                list.push({
                  seqno,
                  headers: Imap.parseHeader(buffer)
                });
              });
            });
          });
          f.once('error', function(err) {
            logError('Fetch error: ' + err);
            reject(err);
          });
          f.once('end', function() {
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
      parent[i] = hash.get(mid(msg)) || -1;
      if (parent[i] != -1) isLast[parent[i]] = false;
    }
  }

  return {
    parent,
    isLast
  };
}

function filterInterstingEmails(msgs: MessageItem[], reviewerEmails: string[]): MessageItem[] {
  const ret: MessageItem[] = [];
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
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    if (!isLast[i]) continue;
    const root = getRoot(i);

    const isInternal = root.headers["to"][0] == CC_EMAIL ||
      (root.headers["cc"] && root.headers["cc"].length == 2
        && root.headers["cc"][0] == CC_EMAIL);

    const isUnreply = !reviewerEmails.includes(msg.headers["from"][0]);

    if (isInternal && isUnreply) {
      ret.push(msg);
    }
  }
  return ret;
}

/** Get Intersted Emails, i.e. from os kernel groups and
  * not replied by internal reviewer.
  */
export async function getInterstedEmails(): Promise<MessageItem[]> {
  const configString = await readFile(CONFIG_FILE, "utf8");
  const { username, password, reviewerEmails } = JSON.parse(configString);
  const allMessages = await getAllEmails(username, password);
  const interestingEmails = filterInterstingEmails(allMessages, reviewerEmails);
  log(inspect(interestingEmails, false, null, true));
  return interestingEmails;
}

