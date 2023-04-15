import Imap from 'imap';
import { readFile } from 'fs/promises'
import { inspect } from 'util';

const log = (msg: string) => {
  const time = new Date().toTimeString();
  console.log("[LOG][%s] %s", time, msg);
}

const logError = (msg: string) => {
  const time = new Date().toTimeString();
  console.error("[ERR][%s] %s", time, msg);
}


type MessageItem = {
  seqno: number;
  headers: {
    [index: string]: string[]
  };
}

function getAllEmails(username: string, password: string): Promise<MessageItem> {
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
                resolve({
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

