import { start as startJob } from '@/job'
import { start as startWeb } from '@/web'
import { CONFIG_FILE } from '@/config'
import { existsSync } from 'fs'
import { logError } from '@/log'

if (!existsSync(CONFIG_FILE)) {
  logError("secrets file not found. App exit.");
  process.exit(1);
}

startWeb();
startJob();
