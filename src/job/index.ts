import { scheduleJob } from "node-schedule";
import { getInterestingEmails } from "./email";
import { sync } from './lark'
import { CRON_EXP } from "@/config";
import { logError } from "@/log";


export function start() {
  const execJob = async () => {
    try {
      const emails = await getInterestingEmails();
      await sync(emails);
    }
    catch (e) {
      logError("Fatal error when executing schedule job", e);
    }
  }
  scheduleJob(CRON_EXP, execJob);
  execJob();
}


