import { Color, Icon } from "@raycast/api";
import { Task } from "./types";

export function isCompleted(task: Task): boolean {
  if (task.status === "completed") {
    return true;
  } else {
    return false;
  }
}

export function getIcon(task: Task): { source: Icon; tintColor?: Color } {
  const due_date = task.due === undefined ? new Date() : new Date(task.due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Due
  if (!isCompleted(task) && due_date < today) {
    return { source: Icon.Circle, tintColor: Color.Red };
  }
  // Completed
  else if (isCompleted(task)) {
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  }
  // Uncomplete
  else {
    return { source: Icon.Circle };
  }
}
