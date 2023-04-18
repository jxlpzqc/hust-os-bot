import { readFile } from 'fs/promises';

type Secrets = {
  username: string;
  password: string;
  key: string;
  appId: string;
  appSecret: string;
  internalGroupName: string;
  // allGroupName: string;
  reviewerEmails: string[];

}

export const CONFIG_FILE = process.env.SECRETS_FILE || ".secrets.json";
export const CRON_EXP = process.env.CRON_EXP || "*/3 * * * *";
export const BASE_URL = process.env.URL || "https://kernel-task.fancybag.cn:3000";

export async function getSecrets() {
  const secrets = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  return secrets as Secrets;
}
