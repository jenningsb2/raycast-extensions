import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { Task, TaskForm } from "../types";
import CreateTaskForm from "./CreateTaskForm";

export default function EmptyView(props: {
  listId: string;
  tasks: Task[];
  searchText: string;
  onCreate: (listId: string, task: TaskForm) => void;
}) {
  if (props.searchText && props.tasks.length === 0) {
    return (
      <List.EmptyView
        title="No Tasks"
        description="Create a new task by pressing the ⏎ key."
        actions={
          <ActionPanel>
            <Action.Push
              title="Create Task"
              icon={Icon.Plus}
              target={<CreateTaskForm listId={props.listId} title={props.searchText} onCreate={props.onCreate} />}
            />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List.EmptyView
      title="No Tasks"
      description="Create a new task by pressing the ⏎ key."
      actions={
        <ActionPanel>
          <Action.Push
            title="Create Task"
            icon={Icon.Plus}
            target={<CreateTaskForm listId={props.listId} onCreate={props.onCreate} />}
          />
        </ActionPanel>
      }
    />
  );
}
