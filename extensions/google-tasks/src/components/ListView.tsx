import { List, Toast, showToast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import * as google from "../api/oauth";
import { createTask, deleteTask, editTask, fetchList, fetchLists, toggleTask } from "../api/endpoints";
import { Filter, Task, TaskForm } from "../types";
import TaskItem from "./TaskItem";
import EmptyView from "./EmptyView";
import { isCompleted } from "../utils";

type State = {
  filter: Filter;
  isLoading: boolean;
  searchText: string;
  tasks: Task[];
  lists: { id: string; title: string }[];
};

export default function ListView(props: { listId: string }) {
  const [state, setState] = useState<State>({
    filter: Filter.Open,
    isLoading: true,
    searchText: "",
    tasks: [],
    lists: [],
  });

  // Fetch lists on mount
  useEffect(() => {
    (async () => {
      try {
        await google.authorize();
        const fetchedLists = await fetchLists();
        setState((previous) => ({
          ...previous,
          lists: fetchedLists,
        }));
      } catch (error) {
        console.error(error);
        showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    })();
  }, []);

  // Fetch tasks when list or filter changes
  useEffect(() => {
    (async () => {
      try {
        setState((previous) => ({ ...previous, isLoading: true }));
        await google.authorize();
        const showCompleted = state.filter === Filter.All || state.filter === Filter.Completed;
        const fetchedList = await fetchList(props.listId, showCompleted);
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
  }, [props.listId, state.filter]);

  const handleCreate = useCallback(
    (listId: string, taskToCreate: TaskForm) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await createTask(props.listId, taskToCreate);
          const refreshedList = await fetchList(props.listId);
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
    [state.tasks, setState]
  );
  const handleEdit = useCallback(
    (listId: string, taskToEdit: Task) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await editTask(props.listId, taskToEdit);
          const refreshedList = await fetchList(props.listId);
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
    [state.tasks, setState]
  );

  const handleToggle = useCallback(
    (taskToToggle: Task) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await toggleTask(props.listId, taskToToggle);
          const refreshedList = await fetchList(props.listId);
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
    [state.tasks, setState]
  );

  const handleDelete = useCallback(
    (taskToDelete: Task) => {
      (async () => {
        try {
          setState((previous) => ({ ...previous, isLoading: true }));
          await deleteTask(props.listId, taskToDelete.id);
          const refreshedList = await fetchList(props.listId);
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
    [state.tasks, setState]
  );

  const filterTasks = useCallback(() => {
    if (state.filter === Filter.Open) {
      return state.tasks.filter((task) => !isCompleted(task));
    }
    if (state.filter === Filter.Completed) {
      return state.tasks.filter((task) => isCompleted(task));
    }
    return state.tasks;
  }, [state.tasks, state.filter]);

  return (
    <List
      isShowingDetail
      isLoading={state.isLoading}
      searchText={state.searchText}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Tasks..."
          value={state.filter}
          onChange={(newValue) =>
            setState((previous) => ({
              ...previous,
              filter: newValue as Filter,
            }))
          }
        >
          <List.Dropdown.Item title="All" value={Filter.All} />
          <List.Dropdown.Item title="Open" value={Filter.Open} />
          <List.Dropdown.Item title="Completed" value={Filter.Completed} />
        </List.Dropdown>
      }
      enableFiltering
      onSearchTextChange={(newValue) => {
        setState((previous) => ({ ...previous, searchText: newValue }));
      }}
    >
      {filterTasks().map((task) => {
        return (
          <TaskItem
            key={task.id}
            listId={props.listId}
            lists={state.lists}
            tasks={state.tasks}
            task={task}
            onToggle={() => handleToggle(task)}
            onDelete={() => handleDelete(task)}
            onCreate={handleCreate}
            onEdit={handleEdit}
            showCompleted={state.filter === Filter.All || state.filter === Filter.Completed}
            onToggleShowCompleted={() => {
              setState((previous) => ({
                ...previous,
                filter: previous.filter === Filter.Open ? Filter.All : Filter.Open,
              }));
            }}
          />
        );
      })}
      <EmptyView listId={props.listId} tasks={filterTasks()} searchText={state.searchText} onCreate={handleCreate} />
    </List>
  );
}
