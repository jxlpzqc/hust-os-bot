import express from 'express'
import morgan from 'morgan'
import { createHash } from 'crypto'
import { getSecrets } from '@/config'
import { completeTask, getAuth, getGroupMember, getTask, getTasks, uncompleteTask } from '@/api'
import { log } from '@/log'

const app = express();
app.set("view engine", "ejs");
app.use(morgan("combined"));

type TaskInView = {
  summary?: string;
  appLink?: string;
  complete?: boolean;
  extra?: any;
}

const genKey = async (text: string) => {
  const { key } = await getSecrets();
  return createHash("sha256").update(text + key).digest("hex");
}

app.get('/index', async (req, res) => {
  const oid = req.query.openid;
  const key = req.query.key;
  if (!oid || !key) return res.send("Invaid parameters");
  if ((await genKey(oid as string)) != key) return res.send("DO NOT try to hack it.");
  const { internalGroupName } = await getSecrets();
  const members = await getGroupMember(internalGroupName);

  if (!members.find(u => u.member_id == oid)) return res.send("No permission.");

  const tasks = await getTasks();

  const extractExtra = (str: string | undefined) => {
    if (!str) return {};
    try {
      const raw = Buffer.from(str, "base64").toString('utf8');
      return JSON.parse(raw);
    }
    catch {
      return {};
    }
  }

  const items: TaskInView[] = tasks.map(u => ({
    summary: u.summary,
    appLink: `https://applink.feishu.cn/client/todo/detail?guid=${u.id}`,
    extra: extractExtra(u.extra),
    complete: u.complete_time != "0"
  }));

  items.sort((a, b) => {
    const acom = a.complete ? 1 : 0;
    const bcom = b.complete ? 1 : 0;
    if (acom != bcom) return acom - bcom;

    try {
      const ad = new Date(a.extra.date);
      const bd = new Date(b.extra.date);
      return - (ad.getTime() - bd.getTime()); // negative it to order by desc
    }
    catch { }

    return 0;
  })

  return res.render("index.ejs", {
    items
  })
})

app.get("/", async (req, res) => {
  const { appId } = await getSecrets();
  return res.render("login.ejs", {
    appId
  })
})

app.get("/complete/:id", async (req, res) => {
  const oid = req.query.openid;
  const key = req.query.key;
  if (!oid || !key) return res.send("Invaid parameters");
  if ((await genKey(oid as string)) != key) return res.send("DO NOT try to hack it.");

  const id = req.params["id"];
  if (!id) return res.send("Bad request");
  const status = req.query["y"];
  if (!status) {
    const task = await getTask(id);
    const complete = task?.complete_time != "0";
    return res.render("prepare.ejs", {
      complete
    });
  }

  const members = await getGroupMember();
  const name = members.find(u=>u.member_id == oid)?.name || "N/A";
  

  if (status == 'y') {
    await completeTask(id, true, name);
  }
  else {
    await uncompleteTask(id, true, name);
  }

  return res.render("complete.ejs");
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  let ret = req.query.ret as string;
  if (!ret) ret = "/index";

  const addUrlParam = async (url: string, openid: string): Promise<string> => {
    let str = url;
    if (url.indexOf("?") != -1) str += "&";
    else str += "?";
    str += `openid=${openid}&key=${await genKey(openid)}`;
    return str;
  }

  if (!code) return res.send("Invalid parameters.");
  const auth = await getAuth(code as string);
  if (!auth) return res.send("Auth fail!");
  const openid = auth;
  return res.send(await addUrlParam(ret, openid));
})

export function start() {
  let port = 5000;
  if (process.env.PORT) {
    port = parseInt(process.env.PORT);
  }
  log("Web started.");
  app.listen(port, process.env.HOST || "0.0.0.0");
}
