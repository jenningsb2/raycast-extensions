import { useCachedPromise } from "@raycast/utils";
import { getOutputDevices, getInputDevices } from "../audio-device";

type UseAudioDevicesProps = {
  options?: {
    execute?: boolean;
  };
};

export function useAudioDevices({ options }: UseAudioDevicesProps = {}) {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async () => {
      const [output, input] = await Promise.all([getOutputDevices(), getInputDevices()]);
      return { output, input };
    },
    [],
    {
      execute: options?.execute === true,
    },
  );

  return {
    devices: data,
    devicesError: error,
    devicesIsLoading: isLoading,
    devicesRevalidate: revalidate,
  };
}
