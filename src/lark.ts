import { AppType, Client, Domain } from '@larksuiteoapi/node-sdk'
import { readFile } from 'fs/promises'
import { MessageItem } from './email'
import { logError } from 'log';
import { CONFIG_FILE } from 'index';

let client: Client;

async function getClient() {
  if (client) return client;
  const secrets = JSON.parse(await readFile(CONFIG_FILE, "utf8"));

  client = new Client({
    appId: secrets.appId,
    appSecret: secrets.appSecret,
    appType: AppType.SelfBuild,
    domain: Domain.Feishu,
  });
  return client;
}

type InnerPromise<T> = T extends Promise<infer R> ? R : any;
type Task = InnerPromise<ReturnType<typeof getTasks>>[number];

type Extra = {
  type: 'os-mail',
  mid: string
}

function genExtra(msg: MessageItem): string {
  const d = {
    type: 'os-mail',
    mid: msg.headers["message-id"][0]
  }
  const dstr = JSON.stringify(d);
  return Buffer.from(dstr, 'utf8').toString("base64");
}


function mid(t: Task): string | false {
  if (t.extra) {
    try {
      const d = JSON.parse(Buffer.from(t.extra, "base64").toString('utf8'));
      if (d.type == 'os-mail') return (d as Extra).mid;
    }
    catch {
      return false;
    }
  }
  return false;
}


async function createTask(msg: MessageItem) {
  const client = await getClient();
  const ret = await client.task.task.create({
    data: {
      origin: {
        platform_i18n_name: '{"zh_cn": "内核内部审核工作组", "en_us": "Kernel internal review work group"}'
      },
      extra: genExtra(msg),
      summary: `处理邮件 ${msg.headers["subject"][0]}`
    },
  })

  if (ret.code != 0) throw new Error(ret.msg);
}

async function finishTask(t: Task) {
  if (!t.id) return;
  const client = await getClient();
  const ret = await client.task.task.complete({
    path: {
      task_id: t.id
    }
  })
  if (ret.code != 0) throw new Error(ret.msg);
}

async function getTasks() {
  const client = await getClient();
  let hasMore = true;

  const items = [];
  let page_token;
  while (hasMore) {
    const res = await client.task.task.list({
      params: {
        page_size: 100,
        page_token
      }
    });

    if (res.code != 0) throw new Error(res.msg);
    if (res.data?.items) {
      items.push(...res.data.items);
    }
    hasMore = res.data?.has_more || false;
    page_token = res.data?.page_token;
  }

  return items;
}

export async function sync(msgs: MessageItem[]) {
  try {
    const tasks = await getTasks();
    const isInTask = new Array<boolean>(msgs.length).fill(false);
    for (const task of tasks) {
      const messageid = mid(task);
      if (!messageid) continue;
      const msgIndex = msgs.findIndex(u => u.headers["message-id"][0] == messageid);
      if (msgIndex == -1) {
        finishTask(task);
      }
      else {
        isInTask[msgIndex] = true;
      }
    }

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (!isInTask[i]) createTask(msg);
    }
  }
  catch (err: any) {
    logError(err?.message)
  }
}
