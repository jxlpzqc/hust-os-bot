import { MessageItem } from './email'
import { logError } from '../log';
import { createTask as apiCreateTask, completeTask, getGroupMember, getTasks, updateTaskCollaborator, type Task, addTaskCustom } from '../api'
import { BASE_URL } from '@/config';

export type Extra = {
  type: 'os-mail',
  mid: string,
  [index: string]: string
}

function genExtra(msg: MessageItem): string {
  const u: any = {};
  if (msg.headers)
    for (const key in msg.headers) {
      u[key] = msg.headers[key].join(", ") || "";
    }
  const d = {
    type: 'os-mail',
    mid: msg.headers["message-id"][0],
    ...u
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

function genCustom(id: string) {
  const uri = BASE_URL + "/?ret=" + encodeURIComponent("/complete/" + id);
  return JSON.stringify({
    "custom_complete": {
      "android":
      {
        "href": uri
      },
      "ios":
      {
        "href": uri
      },
      "pc":
      {
        "href": uri
      }
    }
  });
}

async function createTask(msg: MessageItem) {
  const task = await apiCreateTask({
    origin: {
      platform_i18n_name: 'Internal review task center',
      href: {
        url: BASE_URL,
        title: "Show in task center"
      }
    },
    extra: genExtra(msg),
    summary: `Please Reply "${msg.headers["subject"][0]}"`,
    collaborator_ids: (await getGroupMember()).map(u => u.member_id).filter(u => !!u) as string[]
  });

  if (task && task.id)
    await addTaskCustom(task.id, genCustom(task.id));
}

async function ensureCollaborators(tasks: Task[]) {
  for (const task of tasks) {
    if (task.id) {
      const ids_old = task.collaborators?.map(u => u.id).filter(u => !!u) as string[] || [];
      const set_old = new Set(ids_old);
      const ids_new = (await getGroupMember()).map(u => u.member_id) as string[];
      const set_new = new Set(ids_new);

      const deletes = ids_old.filter(u => !set_new.has(u));
      const adds = ids_new.filter(u => !set_old.has(u));

      await updateTaskCollaborator(task.id, adds, deletes);
    }
  }

}

export async function sync(msgs: MessageItem[]) {
  try {
    const tasks = await getTasks();
    console.log(tasks)
    await ensureCollaborators(tasks);
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
