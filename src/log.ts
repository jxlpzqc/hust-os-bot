export function getTimeStr() {
  const dt = new Date();
  const padL = (nr: number, len = 2, chr = `0`) => `${nr}`.padStart(len, chr);

  return (`${dt.getFullYear()}/${padL(dt.getMonth() + 1)}/${padL(dt.getDate())} ` +
    `${padL(dt.getHours())}:${padL(dt.getMinutes())}:${padL(dt.getSeconds())}`);
}

export const log = (...msg: any[]) => {
  const time = getTimeStr();
  console.log("[LOG][%s]", time, ...msg);
}

export const logError = (...msg: any[]) => {
  const time = getTimeStr();
  console.error("[ERR][%s]", time, ...msg);
}
