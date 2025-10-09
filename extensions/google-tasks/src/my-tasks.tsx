import { List, Detail, Toast, showToast, LocalStorage, Action, ActionPanel, Icon } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import * as google from "./api/oauth";
import { createTask, deleteTask, editTask, fetchList, fetchLists, toggleTask } from "./api/endpoints";
import { Task, TaskForm } from "./types";
import TaskItem from "./components/TaskItem";
import CreateTaskForm from "./components/CreateTaskForm";
import { isCompleted } from "./utils";

type State = {
  isLoading: boolean;
  searchText: string;
  tasks: Task[];
  lists: { id: string; title: string }[];
  selectedListId: string;
  showCompleted: boolean;
};

export default function Command() {
  const [state, setState] = useState<State>({
    isLoading: true,
    searchText: "",
    tasks: [],
    lists: [],
    selectedListId: "",
    showCompleted: false,
  });
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  // Fetch lists on mount and load last used list
  useEffect(() => {
    (async () => {
      try {
        await google.authorize();
        const fetchedLists = await fetchLists();

        // Load last used list from LocalStorage, or use first list
        const lastUsedListId = await LocalStorage.getItem<string>("lastUsedListId");
        const defaultListId = lastUsedListId || fetchedLists[0]?.id || "";

        // Load showCompleted preference from LocalStorage, default to false
        const showCompletedPref = await LocalStorage.getItem<string>("showCompleted");
        const showCompleted = showCompletedPref === "true";

        setState((previous) => ({
          ...previous,
          lists: fetchedLists,
          selectedListId: defaultListId,
          showCompleted,
        }));
        setHasLoadedPreferences(true);
      } catch (error) {
        console.error(error);
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    })();
  }, []);

  // Save last used list to LocalStorage whenever it changes
  useEffect(() => {
    if (state.selectedListId) {
      LocalStorage.setItem("lastUsedListId", state.selectedListId);
    }
  }, [state.selectedListId]);

  // Save showCompleted preference to LocalStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (hasLoadedPreferences) {
      LocalStorage.setItem("showCompleted", String(state.showCompleted));
    }
  }, [state.showCompleted, hasLoadedPreferences]);

  // Fetch tasks when list changes (always include completed tasks)
  useEffect(() => {
    if (!state.selectedListId) return;

    (async () => {
      try {
        setState((previous) => ({ ...previous, isLoading: true }));
        const fetchedList = await fetchList(state.selectedListId, true); // Always fetch completed tasks
        setState((previous) => ({
          ...previous,
          tasks: fetchedList,
          isLoading: false,
        }));
      } catch (error) {
        console.error(error);
        setState((previous) => ({ ...previous, tasks: [], isLoading: false }));
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    })();
  }, [state.selectedListId]);

  const handleCreate = useCallback(
    (listId: string, taskToCreate: TaskForm) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await createTask(state.selectedListId, taskToCreate);
          const refreshedList = await fetchList(state.selectedListId, true); // Always fetch completed tasks
          setState((previous) => ({
            ...previous,
            tasks: refreshedList,
            isLoading: false,
          }));
        } catch (error) {
          console.error(error);
          setState((previous) => ({
            ...previous,
            tasks: [],
            isLoading: false,
          }));
          showToast({ style: Toast.Style.Failure, title: String(error) });
        }
      })();
    },
    [state.selectedListId]
  );

  const handleEdit = useCallback(
    (newListId: string, taskToEdit: Task, originalListId: string) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await editTask(newListId, taskToEdit, originalListId);

          // Refresh the current list to show updated tasks
          const refreshedList = await fetchList(state.selectedListId, true); // Always fetch completed tasks
          setState((previous) => ({
            ...previous,
            tasks: refreshedList,
            isLoading: false,
          }));

          showToast({
            style: Toast.Style.Success,
            title: "Task Updated",
            message: originalListId !== newListId ? "Task moved to new list" : "Task updated successfully",
          });
        } catch (error) {
          console.error(error);
          setState((previous) => ({
            ...previous,
            tasks: [],
            isLoading: false,
          }));
          showToast({ style: Toast.Style.Failure, title: String(error) });
        }
      })();
    },
    [state.selectedListId]
  );

  const handleToggle = useCallback(
    (taskToToggle: Task) => {
      (async () => {
        async function toggle(task: Task): Promise<Task[]> {
          setState((previous) => ({ ...previous, isLoading: true }));
          await toggleTask(state.selectedListId, task);
          const refreshedList = await fetchList(state.selectedListId, true); // Always fetch completed tasks
          setState((previous) => ({
            ...previous,
            tasks: refreshedList,
            isLoading: false,
          }));
          return refreshedList;
        }

        try {
          const wasCompleted = isCompleted(taskToToggle);

          const refreshedList = await toggle(taskToToggle);

          // Show confirmation message with undo action
          await showToast({
            style: Toast.Style.Success,
            title: wasCompleted ? "Task Reopened" : "Task Completed",
            message: taskToToggle.title,
            primaryAction: {
              title: "Undo",
              shortcut: { modifiers: ["cmd"], key: "z" },
              onAction: async (toast) => {
                // Find the updated task from the refreshed list
                const updatedTask = refreshedList.find((t) => t.id === taskToToggle.id);
                if (updatedTask) {
                  await toggle(updatedTask);
                }
                toast.hide();
              },
            },
          });
        } catch (error) {
          console.error(error);
          setState((previous) => ({
            ...previous,
            tasks: [],
            isLoading: false,
          }));
          showToast({ style: Toast.Style.Failure, title: String(error) });
        }
      })();
    },
    [state.selectedListId]
  );

  const handleDelete = useCallback(
    (taskToDelete: Task) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await deleteTask(state.selectedListId, taskToDelete.id);
          const refreshedList = await fetchList(state.selectedListId, true); // Always fetch completed tasks
          setState((previous) => ({
            ...previous,
            tasks: refreshedList,
            isLoading: false,
          }));
        } catch (error) {
          console.error(error);
          setState((previous) => ({
            ...previous,
            tasks: [],
            isLoading: false,
          }));
          showToast({ style: Toast.Style.Failure, title: String(error) });
        }
      })();
    },
    [state.selectedListId]
  );

  // Organize tasks by due date sections
  const organizeTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    const noDue: Task[] = [];
    const completed: Task[] = [];

    // Helper to parse task due date correctly
    const parseTaskDate = (dueString: string): Date => {
      const isDateOnly = dueString.match(/T00:00:00\.000Z$/);

      if (isDateOnly) {
        // For date-only tasks, parse as local date
        const dateMatch = dueString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }

      // For datetime tasks or fallback, parse normally
      return new Date(dueString);
    };

    state.tasks.forEach((task) => {
      if (isCompleted(task)) {
        completed.push(task);
        return;
      }

      if (!task.due) {
        noDue.push(task);
        return;
      }

      const dueDate = parseTaskDate(task.due);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      if (dueDateOnly < today) {
        overdue.push(task);
      } else if (dueDateOnly.getTime() === today.getTime()) {
        todayTasks.push(task);
      } else {
        upcoming.push(task);
      }
    });

    // Sort by due date
    const sortByDue = (a: Task, b: Task) => {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return parseTaskDate(a.due).getTime() - parseTaskDate(b.due).getTime();
    };

    overdue.sort(sortByDue);
    todayTasks.sort(sortByDue);
    upcoming.sort(sortByDue);

    return { overdue, todayTasks, upcoming, noDue, completed };
  };

  const sections = organizeTasks();

  if (state.lists.length === 0 && state.isLoading) {
    return <Detail isLoading={true} />;
  }

  const renderTasks = (tasks: Task[]) =>
    tasks.map((task) => (
      <TaskItem
        key={task.id}
        listId={state.selectedListId}
        lists={state.lists}
        tasks={state.tasks}
        task={task}
        onToggle={() => handleToggle(task)}
        onDelete={() => handleDelete(task)}
        onCreate={handleCreate}
        onEdit={handleEdit}
        showCompleted={state.showCompleted}
        onToggleShowCompleted={() => setState((prev) => ({ ...prev, showCompleted: !prev.showCompleted }))}
      />
    ));

  return (
    <List
      isLoading={state.isLoading}
      searchText={state.searchText}
      searchBarPlaceholder="Filter by task name..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Select List"
          value={state.selectedListId}
          onChange={(newValue) =>
            setState((previous) => ({
              ...previous,
              selectedListId: newValue,
            }))
          }
        >
          {state.lists.map((list) => (
            <List.Dropdown.Item key={list.id} title={list.title} value={list.id} />
          ))}
        </List.Dropdown>
      }
      enableFiltering
      onSearchTextChange={(newValue) => {
        setState((previous) => ({ ...previous, searchText: newValue }));
      }}
    >
      {sections.overdue.length > 0 && (
        <List.Section
          title="Overdue"
          subtitle={`${sections.overdue.length} task${sections.overdue.length === 1 ? "" : "s"}`}
        >
          {renderTasks(sections.overdue)}
        </List.Section>
      )}
      {sections.todayTasks.length > 0 && (
        <List.Section
          title="Today"
          subtitle={`${sections.todayTasks.length} task${sections.todayTasks.length === 1 ? "" : "s"}`}
        >
          {renderTasks(sections.todayTasks)}
        </List.Section>
      )}
      {sections.upcoming.length > 0 && (
        <List.Section
          title="Upcoming"
          subtitle={`${sections.upcoming.length} task${sections.upcoming.length === 1 ? "" : "s"}`}
        >
          {renderTasks(sections.upcoming)}
        </List.Section>
      )}
      {sections.noDue.length > 0 && (
        <List.Section
          title="No Due Date"
          subtitle={`${sections.noDue.length} task${sections.noDue.length === 1 ? "" : "s"}`}
        >
          {renderTasks(sections.noDue)}
        </List.Section>
      )}
      {state.showCompleted && sections.completed.length > 0 && (
        <List.Section
          title="Completed"
          subtitle={`${sections.completed.length} task${sections.completed.length === 1 ? "" : "s"}`}
        >
          {renderTasks(sections.completed)}
        </List.Section>
      )}
      <List.EmptyView
        title="No Tasks"
        description="Create a new task by pressing the ⏎ key."
        actions={
          <ActionPanel>
            <Action.Push
              title="Create Task"
              icon={Icon.NewDocument}
              target={<CreateTaskForm listId={state.selectedListId} title={state.searchText} onCreate={handleCreate} />}
            />
            <Action
              title={state.showCompleted ? "Hide Completed Tasks" : "Show Completed Tasks"}
              icon={state.showCompleted ? Icon.EyeDisabled : Icon.Eye}
              shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
              onAction={() => setState((prev) => ({ ...prev, showCompleted: !prev.showCompleted }))}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
