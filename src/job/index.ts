import { scheduleJob } from "node-schedule";
import { getInterstedEmails } from "./email";
import { sync } from './lark'
import { existsSync } from 'fs'
import { logError } from "../log";

export const CONFIG_FILE = process.env.SECRETS_FILE || ".secrets.json";
export const CRON_EXP = process.env.CRON_EXP || "*/3 * * * *";

export function start() {
  if (!existsSync(CONFIG_FILE)) {
    logError("secrets file not found. App exit.");
    process.exit(1);
  }
  const execJob = async () => {
    const emails = await getInterstedEmails();
    await sync(emails);
  }
  scheduleJob(CRON_EXP, execJob);
  execJob();
}


