import { MessageItem } from './email'
import { logError } from '../log';
import { createTask as apiCreateTask, completeTask, getGroupMember, getTasks, updateTaskFollowers, type Task } from '../api'

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
  return await apiCreateTask({
    origin: {
      platform_i18n_name: '{"zh_cn": "内核内部审核工作组", "en_us": "Kernel internal review work group"}'
    },
    extra: genExtra(msg),
    summary: `处理邮件 ${msg.headers["subject"][0]}`,
    follower_ids: (await getGroupMember()).map(u => u.member_id).filter(u => !!u) as string[]
  });
}

async function ensureFollowerID(tasks: Task[]) {
  for (const task of tasks) {
    if (task.id && task.follower_ids) {
      const ids_old = task.follower_ids;
      const set_old = new Set(ids_old);
      const ids_new = (await getGroupMember()).map(u => u.member_id) as string[];
      const set_new = new Set(ids_new);

      const deletes = ids_old.filter(u => !set_new.has(u));
      const adds = ids_new.filter(u => !set_old.has(u));

      await updateTaskFollowers(task.id, adds, deletes);
    }
  }

}

export async function sync(msgs: MessageItem[]) {
  try {
    const tasks = await getTasks();
    ensureFollowerID(tasks);
    const isInTask = new Array<boolean>(msgs.length).fill(false);
    for (const task of tasks) {
      const messageid = mid(task);
      if (!messageid) continue;
      const msgIndex = msgs.findIndex(u => u.headers["message-id"][0] == messageid);
      if (msgIndex == -1) {
        completeTask(task);
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
