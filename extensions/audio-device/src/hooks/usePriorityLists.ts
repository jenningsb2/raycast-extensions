import { useCachedPromise } from "@raycast/utils";
import { getOutputPriorityList, getInputPriorityList } from "../priority-utils";

type UsePriorityListsProps = {
  options?: {
    execute?: boolean;
  };
};

export function usePriorityLists({ options }: UsePriorityListsProps = {}) {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async () => {
      const [output, input] = await Promise.all([getOutputPriorityList(), getInputPriorityList()]);
      return { output, input };
    },
    [],
    {
      execute: options?.execute !== false,
    },
  );

  return {
    priorityLists: data,
    priorityListsError: error,
    priorityListsIsLoading: isLoading,
    priorityListsRevalidate: revalidate,
  };
}
