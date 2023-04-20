import { AppType, Client, Domain } from '@larksuiteoapi/node-sdk'
import { getSecrets } from './config';
import { getTimeStr } from './log';

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

export async function getTask(id: string): Promise<Task | undefined> {
  const client = await getClient();
  const d = await client.task.task.get({
    path: { task_id: id }
  })

  return d.data?.task;
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

export async function completeTask(t: Task | string, manually = false, name: string = "Bot") {
  let id;
  if (typeof (t) == "string") id = t;
  else if (!t.id) return;
  else id = t.id;

  const client = await getClient();
  const ret = await client.task.task.complete({
    path: {
      task_id: id
    }
  })
  if (ret.code != 0) throw new Error(ret.msg);

  await client.task.taskComment.create({
    path: {
      task_id: id,
    },
    data: {
      content: (manually ? "Manually" : "Automatically") + " completed at " + getTimeStr() + " by " + name
    }
  });
}

export async function uncompleteTask(t: Task | string, manually = false, name = "Bot") {
  let id;
  if (typeof (t) == "string") id = t;
  else if (!t.id) return;
  else id = t.id;

  const client = await getClient();
  const ret = await client.task.task.uncomplete({
    path: {
      task_id: id
    }
  })
  if (ret.code != 0) throw new Error(ret.msg);

  await client.task.taskComment.create({
    path: {
      task_id: id,
    },
    data: {
      content: (manually ? "Manually" : "Automatically") + " uncompleted at " + getTimeStr() + " by " + name
    }
  });
}

export async function addTaskCustom(tid: string, custom: string) {
  const client = await getClient();
  client.task.task.patch({
    path: {
      task_id: tid
    },
    data: {
      task: {
        custom
      },
      update_fields: ["custom"]
    },
  })
}

export async function getTasks() {
  const client = await getClient();

  const ret = [];
  let hasMore = true;
  let token;

  while (hasMore) {
    const d = await client.task.task.list({
      params: {
        page_token: token
      }
    });
    if (d.code != 0) throw new Error("Request error");

    hasMore = d.data?.has_more || false;
    token = d.data?.page_token;
    ret.push(...d.data?.items!);
  }

  return ret;
}

export async function deleteTask(tid: string) {
  const client = await getClient();
  await client.task.task.delete({
    path: {
      task_id: tid
    }
  })
}

export type CreateTaskArg = NonNullable<Parameters<typeof client.task.task.create>[0]>['data'];

export async function createTask(data: CreateTaskArg) {
  const client = await getClient();
  const ret = await client.task.task.create({
    data,
  })

  if (ret.code != 0) throw new Error(ret.msg);
  return ret.data?.task;
}

export type Member = InnerPromise<ReturnType<typeof getGroupMember>>[number];

let cachedExpireTime: { [index: string]: Date } = {};
let cachedItem: { [index: string]: never[] } = {}; // use never to ensure Member inference.

export async function getGroupMember(groupName: string = "") {
  if (!!cachedItem[groupName] && !!cachedExpireTime[groupName] &&
    new Date() < cachedExpireTime[groupName])
    return cachedItem[groupName];

  const client = await getClient();
  if (!groupName) {
    const { internalGroupName } = await getSecrets();
    groupName = internalGroupName;
  }

  let group;

  let hasMore = true;
  let token;

  while (hasMore) {
    const d = await client.im.chat.list({
      params: {
        page_token: token
      }
    });
    if (d.code != 0) throw new Error("Request error");

    hasMore = d.data?.has_more || false;
    token = d.data?.page_token;

    const item = d.data?.items?.find(u => u.name == groupName);
    if (item) {
      group = item;
      break;
    }
  }


  if (!group || !group.chat_id) {
    throw new Error("No such group, you should add bot in the group");
  }
  const chat = group.chat_id;

  const ret = [];

  hasMore = true;
  token;

  while (hasMore) {
    const d = await client.im.chatMembers.get({
      params: {
        page_token: token,
        member_id_type: 'open_id'
      },
      path: {
        chat_id: chat
      }
    });
    if (d.code != 0) throw new Error("Request error");

    hasMore = d.data?.has_more || false;
    token = d.data?.page_token;

    if (d?.data?.items)
      ret.push(...d?.data?.items);

  }

  cachedItem[groupName] = <never[]>ret;
  cachedExpireTime[groupName] = new Date();
  cachedExpireTime[groupName].setMinutes(cachedExpireTime[groupName].getMinutes() + 3);
  return ret;
}

export async function updateTaskCollaborator(tid: string, addIds: string[], removeIds: string[]) {
  const client = await getClient();
  if (addIds.length)
    await client.task.taskCollaborator.create({
      data: {
        id_list: addIds
      },
      path: {
        task_id: tid
      }
    });
  if (removeIds.length)
    for (const id of removeIds) {
      await client.task.taskCollaborator.delete({
        path: {
          task_id: tid,
          collaborator_id: id
        }
      });
    }
}
