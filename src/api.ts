import { AppType, Client, Domain } from '@larksuiteoapi/node-sdk'
import { getSecrets } from './config';

let client: Client;

async function getClient() {
  if (client) return client;

  const secrets = await getSecrets();

  client = new Client({
    appId: secrets.appId,
    appSecret: secrets.appSecret,
    appType: AppType.SelfBuild,
    domain: Domain.Feishu,
  });
  return client;
}

export async function getAuth(code: string): Promise<string | false> {
  const client = await getClient();
  const ret = await client.authen.accessToken.create({
    data: {
      code,
      grant_type: 'authorization_code'
    }
  });

  if (ret.code) return false;
  return ret.data?.open_id || false;
}

type InnerPromise<T> = T extends Promise<infer R> ? R : any;
export type Task = InnerPromise<ReturnType<typeof getTasks>>[number];

export async function completeTask(t: Task) {
  if (!t.id) return;
  const client = await getClient();
  const ret = await client.task.task.complete({
    path: {
      task_id: t.id
    }
  })
  if (ret.code != 0) throw new Error(ret.msg);
}

export async function getTasks() {
  const client = await getClient();

  const ret = [];
  for await (const item of await client.task.task.listWithIterator({
    params: {
      page_size: 100,
    }
  })) {
    if (!item || !item.items) throw new Error("get task failed.");
    ret.push(...item!.items);
  }

  return ret;
}

export type CreateTaskArg = NonNullable<Parameters<typeof client.task.task.create>[0]>['data'];

export async function createTask(data: CreateTaskArg) {
  const client = await getClient();
  const ret = await client.task.task.create({
    data,
  })

  if (ret.code != 0) throw new Error(ret.msg);
}
