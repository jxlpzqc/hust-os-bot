import express from 'express'
import morgan from 'morgan'
import { createHash } from 'crypto'
import { getSecrets } from '@/config'
import { getAuth, getTasks } from '@/api'
import { log } from '@/log'

const app = express();
app.set("view engine", "ejs");
app.use(morgan("combined"));

type TaskInView = {
  summary?: string;
  appLink?: string;
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

  const tasks = await getTasks();
  const items: TaskInView[] = tasks.map(u => ({
    summary: u.summary,
    appLink: `https://applink.feishu.cn/client/todo/detail?guid=${u.id}`
  }));
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

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Invalid parameters.");
  const auth = await getAuth(code as string);
  if (!auth) return res.send("Auth fail!");
  const openid = auth;
  return res.send(`/index?openid=${openid}&&key=${await genKey(openid)}`);
})

export function start() {
  let port = 5000;
  if (process.env.PORT) {
    port = parseInt(process.env.PORT);
  }
  log("Web started.");
  app.listen(port, process.env.HOST || "0.0.0.0");
}
