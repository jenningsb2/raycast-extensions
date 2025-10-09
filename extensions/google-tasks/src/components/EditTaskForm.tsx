import { Form, ActionPanel, Action, useNavigation, Icon, Toast, showToast, Detail } from "@raycast/api";
import { useCallback, useState, useEffect } from "react";
import { Task } from "../types";
import * as google from "../api/oauth";
import { fetchLists } from "../api/endpoints";

export default function EditTaskForm(props: {
  listId: string;
  task: Task;
  onEdit: (newListId: string, task: Task, originalListId: string) => void;
}) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lists, setLists] = useState<{ id: string; title: string }[]>([]);
  const originalListId = props.listId;

  useEffect(() => {
    (async () => {
      try {
        await google.authorize();
        const fetchedLists = await fetchLists();
        setLists(fetchedLists);
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        setIsLoading(false);
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    })();
  }, []);

  const handleSubmit = useCallback(
    (values: { title: string; notes: string; due: Date | null; listId: string }) => {
      const dueString = values.due
        ? new Date(values.due.getFullYear(), values.due.getMonth(), values.due.getDate()).toISOString().split("T")[0] +
          "T00:00:00.000Z"
        : undefined;

      props.onEdit(
        values.listId,
        {
          ...props.task,
          title: values.title,
          notes: values.notes,
          due: dueString,
        },
        originalListId
      );
      pop();
    },
    [props.onEdit, pop, originalListId, props.task]
  );

  if (isLoading) {
    return <Detail isLoading={isLoading} />;
  }

  // Parse the due date correctly, handling timezone issues
  const getDefaultDueDate = (): Date | undefined => {
    if (!props.task.due) return undefined;

    const isDateOnly = props.task.due.match(/T00:00:00\.000Z$/);
    if (isDateOnly) {
      // For date-only tasks, parse as local date to avoid timezone shift
      const dateMatch = props.task.due.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    return new Date(props.task.due);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Edit Task" icon={Icon.Pencil} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" defaultValue={props.task.title} />
      <Form.TextArea id="notes" title="Details" defaultValue={props.task.notes} />
      <Form.DatePicker id="due" title="Due Date" type={Form.DatePicker.Type.Date} defaultValue={getDefaultDueDate()} />
      <Form.Dropdown id="listId" title="Task List" defaultValue={props.listId}>
        {lists.map((list) => {
          return <Form.Dropdown.Item value={list.id} title={list.title} key={list.id} />;
        })}
      </Form.Dropdown>
    </Form>
  );
}
