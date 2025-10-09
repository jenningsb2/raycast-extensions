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
    (values: { title: string; notes: string; due: string; listId: string }) => {
      props.onEdit(
        values.listId,
        {
          ...props.task,
          title: values.title,
          notes: values.notes,
          due: values.due,
        },
        originalListId
      );
      pop();
    },
    [props.onEdit, pop, originalListId]
  );

  if (isLoading) {
    return <Detail isLoading={isLoading} />;
  }

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
      <Form.DatePicker
        id="due"
        title="Due Date"
        type={Form.DatePicker.Type.Date}
        defaultValue={props.task.due === undefined ? undefined : new Date(props.task.due)}
      />
      <Form.Dropdown id="listId" title="Task List" defaultValue={props.listId}>
        {lists.map((list) => {
          return <Form.Dropdown.Item value={list.id} title={list.title} key={list.id} />;
        })}
      </Form.Dropdown>
    </Form>
  );
}
