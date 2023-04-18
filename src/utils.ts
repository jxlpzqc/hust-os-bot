import { deleteTask, getTasks } from "./api";
import { log, logError } from "@/log";

export async function clearTodoTask() {
  const tasks = await getTasks();
  log(`Removing ${tasks.length} tasks`);
  for (const t of tasks) {
    try {
      if (t.id) await deleteTask(t.id);
    }
    catch (e) {
      logError(`Error handle tasks ${t.id}`, t, e);
    }
  }
  log("Finished");
}
