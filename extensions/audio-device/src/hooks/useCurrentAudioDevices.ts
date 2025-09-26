import { useCachedPromise } from "@raycast/utils";
import { getDefaultOutputDevice, getDefaultInputDevice } from "../audio-device";

type UseCurrentAudioDevicesProps = {
  options?: {
    execute?: boolean;
  };
};

export function useCurrentAudioDevices({ options }: UseCurrentAudioDevicesProps = {}) {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async () => {
      const [output, input] = await Promise.all([getDefaultOutputDevice(), getDefaultInputDevice()]);
      return { output, input };
    },
    [],
    {
      execute: options?.execute !== false,
    },
  );

  return {
    currentDevices: data,
    currentDevicesError: error,
    currentDevicesIsLoading: isLoading,
    currentDevicesRevalidate: revalidate,
  };
}
