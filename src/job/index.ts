import { scheduleJob } from "node-schedule";
import { getInterestingEmails } from "./email";
import { sync } from './lark'
import { existsSync } from 'fs'
import { logError } from "../log";
import { CONFIG_FILE, CRON_EXP } from "@/config";


export function start() {
  if (!existsSync(CONFIG_FILE)) {
    logError("secrets file not found. App exit.");
    process.exit(1);
  }
  const execJob = async () => {
    const emails = await getInterestingEmails();
    await sync(emails);
  }
  scheduleJob(CRON_EXP, execJob);
  execJob();
}


