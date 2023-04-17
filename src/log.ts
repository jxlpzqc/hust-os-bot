function getTimeStr() {
  const dt = new Date();
  const padL = (nr: number, len = 2, chr = `0`) => `${nr}`.padStart(2, chr);

  return (`${dt.getFullYear()}/${padL(dt.getMonth() + 1)}/${padL(dt.getDate())} ` +
    `${padL(dt.getHours())}:${padL(dt.getMinutes())}:${padL(dt.getSeconds())}`);
}

export const log = (msg: string) => {
  const time = getTimeStr();
  console.log("[LOG][%s] %s", time, msg);
}

export const logError = (msg: string) => {
  const time = getTimeStr();
  console.error("[ERR][%s] %s", time, msg);
}
