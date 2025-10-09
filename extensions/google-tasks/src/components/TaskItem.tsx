import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { Task, TaskForm } from "../types";
import { getIcon, isCompleted } from "../utils";
import CreateTaskForm from "./CreateTaskForm";
import EditTaskForm from "./EditTaskForm";

export default function TaskItem(props: {
  listId: string;
  lists: { id: string; title: string }[];
  tasks: Task[];
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onCreate: (listId: string, task: TaskForm) => void;
  onEdit: (newListId: string, task: Task, originalListId: string) => void;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
}) {
  const formatDueDate = (due: string | undefined): string => {
    if (!due) return "";

    // Google Tasks API returns dates in RFC 3339 format
    // For date-only tasks: "2025-10-09T00:00:00.000Z" (midnight UTC - represents Oct 9 date)
    // For datetime tasks: "2025-10-09T18:00:00.000Z" (specific time UTC)

    const isDateOnly = due.match(/T00:00:00\.000Z$/);

    let dueDate: Date;
    let dueDateLocal: Date;

    if (isDateOnly) {
      // For date-only tasks, parse as the intended date regardless of timezone
      // Extract YYYY-MM-DD from the string
      const dateMatch = due.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        dueDateLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        dueDate = dueDateLocal;
      } else {
        dueDate = new Date(due);
        dueDateLocal = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      }
    } else {
      // For datetime tasks, parse normally (will convert from UTC to local)
      dueDate = new Date(due);
      // Extract just the date portion in local timezone
      dueDateLocal = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDateLocal.getTime() === today.getTime()) {
      if (!isDateOnly) {
        return `Today, ${dueDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      }
      return "Today";
    } else if (dueDateLocal.getTime() === tomorrow.getTime()) {
      if (!isDateOnly) {
        return `Tomorrow, ${dueDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      }
      return "Tomorrow";
    } else {
      if (!isDateOnly) {
        return dueDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }
      return dueDateLocal.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatCompletedDate = (completed: string | undefined): string => {
    if (!completed) return "";

    const isDateOnly = completed.match(/T00:00:00\.000Z$/);
    let completedDate: Date;
    let completedDateLocal: Date;

    if (isDateOnly) {
      const dateMatch = completed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        completedDateLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        completedDate = completedDateLocal;
      } else {
        completedDate = new Date(completed);
        completedDateLocal = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
      }
    } else {
      completedDate = new Date(completed);
      completedDateLocal = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (completedDateLocal.getTime() === today.getTime()) {
      return "Today";
    } else if (completedDateLocal.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return completedDateLocal.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const taskIsCompleted = isCompleted(props.task);

  return (
    <List.Item
      key={props.task.id}
      icon={getIcon(props.task)}
      id={props.task.id}
      title={props.task.title}
      accessories={[
        {
          text: taskIsCompleted ? formatCompletedDate(props.task.completed) : formatDueDate(props.task.due),
          icon: taskIsCompleted ? undefined : props.task.due ? Icon.Calendar : undefined,
        },
      ]}
      actions={
        <ActionPanel>
          <Action
            title={taskIsCompleted ? "Mark as Incomplete" : "Mark as Complete"}
            icon={taskIsCompleted ? Icon.Circle : Icon.CheckCircle}
            onAction={props.onToggle}
          />
          <Action.Push
            title="Edit Task"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            target={<EditTaskForm listId={props.listId} task={props.task} onEdit={props.onEdit} />}
          />
          <Action.Push
            title="Create Task"
            icon={Icon.NewDocument}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            target={<CreateTaskForm listId={props.listId} onCreate={props.onCreate} />}
          />
          <Action
            title="Delete Task"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
            onAction={props.onDelete}
          />
          <Action.PickDate
            title="Schedule"
            icon={Icon.Calendar}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
            type={Action.PickDate.Type.Date}
            onChange={(date) => {
              if (date) {
                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const dateString = selectedDate.toISOString().split("T")[0] + "T00:00:00.000Z";
                const updatedTask = { ...props.task, due: dateString };
                props.onEdit(props.listId, updatedTask, props.listId);
              } else {
                const updatedTask = { ...props.task, due: undefined };
                props.onEdit(props.listId, updatedTask, props.listId);
              }
            }}
          />
          <Action
            title="Set Due to Today"
            icon={Icon.Calendar}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={() => {
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const todayString = today.toISOString().split("T")[0] + "T00:00:00.000Z";
              const updatedTask = { ...props.task, due: todayString };
              props.onEdit(props.listId, updatedTask, props.listId);
            }}
          />
          <Action
            title="Clear Due Date"
            icon={Icon.XMarkCircle}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={() => {
              const updatedTask = { ...props.task, due: undefined };
              props.onEdit(props.listId, updatedTask, props.listId);
            }}
          />
          <ActionPanel.Submenu
            title="Move to List"
            icon={Icon.ArrowRight}
            shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
          >
            {props.lists
              .filter((list) => list.id !== props.listId)
              .map((list) => (
                <Action
                  key={list.id}
                  title={list.title}
                  icon={Icon.List}
                  onAction={async () => {
                    props.onEdit(list.id, props.task, props.listId);
                    await showToast({
                      style: Toast.Style.Success,
                      title: `Moved "${props.task.title}" to "${list.title}"`,
                    });
                  }}
                />
              ))}
          </ActionPanel.Submenu>
          <Action
            title={props.showCompleted ? "Hide Completed Tasks" : "Show Completed Tasks"}
            icon={props.showCompleted ? Icon.EyeDisabled : Icon.Eye}
            shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
            onAction={props.onToggleShowCompleted}
          />
        </ActionPanel>
      }
    />
  );
}
