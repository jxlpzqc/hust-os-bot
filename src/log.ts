export const log = (msg: string) => {
  const time = new Date().toTimeString();
  console.log("[LOG][%s] %s", time, msg);
}

export const logError = (msg: string) => {
  const time = new Date().toTimeString();
  console.error("[ERR][%s] %s", time, msg);
}
