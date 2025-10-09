import { Detail, Toast, showToast, Form, ActionPanel, Action, getPreferenceValues, popToRoot, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";
import * as google from "./api/oauth";
import { fetchLists, createTask } from "./api/endpoints";
import { TaskForm } from "./types";
import { useForm, FormValidation } from "@raycast/utils";

interface CreateTaskFormValues {
  title: string;
  notes: string;
  due: Date | null;
  listId: string;
}

interface CommandPreferences {
  defaultDueDate?: "none" | "today" | "tomorrow";
}

function getDefaultDueDate(preference: string | undefined): Date | null {
  if (!preference || preference === "none") {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preference === "today") {
    return today;
  }

  if (preference === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  return null;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lists, setLists] = useState<{ id: string; title: string }[]>([]);
  const [defaultListId, setDefaultListId] = useState<string>("");
  const commandPreferences = getPreferenceValues<CommandPreferences>({ commandName: "create-task" });

  const defaultDueDate = getDefaultDueDate(commandPreferences.defaultDueDate);

  const { handleSubmit, itemProps, setValue } = useForm<CreateTaskFormValues>({
    async onSubmit(values) {
      try {
        // Save the selected list as the last used list
        await LocalStorage.setItem("lastUsedListId", values.listId);

        await createTask(values.listId, {
          title: values.title,
          notes: values.notes,
          due: values.due,
        });
        showToast({
          style: Toast.Style.Success,
          title: "Task Created!",
          message: `${values.title} created`,
        });
        popToRoot();
      } catch (error) {
        console.error(error);
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    },
    initialValues: {
      listId: "",
      due: defaultDueDate,
    },
    validation: {
      title: FormValidation.Required,
      listId: FormValidation.Required,
    },
  });

  useEffect(() => {
    (async () => {
      try {
        await google.authorize();
        const fetchedLists = await fetchLists();
        setLists(fetchedLists);

        // Load last used list from LocalStorage
        const lastUsedListId = await LocalStorage.getItem<string>("lastUsedListId");
        const initialListId = lastUsedListId || fetchedLists[0]?.id || "";

        setDefaultListId(initialListId);
        setValue("listId", initialListId);
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        setIsLoading(false);
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    })();
  }, []);

  if (isLoading) {
    return <Detail isLoading={isLoading} />;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Title" placeholder="Enter task title" {...itemProps.title} />
      <Form.TextArea title="Details" placeholder="Enter task details (optional)" {...itemProps.notes} />
      <Form.DatePicker title="Due Date" type={Form.DatePicker.Type.Date} {...itemProps.due} />
      <Form.Dropdown title="Task List" {...itemProps.listId}>
        {lists.map((list) => {
          return <Form.Dropdown.Item value={list.id} title={list.title} key={list.id} />;
        })}
      </Form.Dropdown>
    </Form>
  );
}
