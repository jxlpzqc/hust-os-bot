import { start as startJob } from '@/job'
import { getTasks } from '@/job/lark'
import express from 'express'

startJob();

const app = express();

app.set("view engine", "ejs");

type TaskInView = {
  summary?: string;
  appLink?: string;
}

app.get('/', async (req, res) => {
  const tasks = await getTasks();
  const items: TaskInView[] = tasks.map(u => ({
    summary: u.summary,
    appLink: ``
  }));
  return res.render("index.ejs", {
    items: tasks
  })
})
