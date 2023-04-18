import { start as startJob } from '@/job'
import { start as startWeb } from '@/web'
import { CONFIG_FILE } from '@/config'
import { existsSync } from 'fs'
import { logError } from '@/log'
import * as utils from '@/utils'

if (!existsSync(CONFIG_FILE)) {
  logError("secrets file not found. App exit.");
  process.exit(1);
}

const option = process.argv.slice(2)[0];
if (!!option) {
  switch (option) {
    case ("clear"):
      utils.clearTodoTask();
      break;
    default:
      logError(`Unsupported option "${option}"`);
      process.exit(1);
  }
}
else {
  startWeb();
  startJob();
}

