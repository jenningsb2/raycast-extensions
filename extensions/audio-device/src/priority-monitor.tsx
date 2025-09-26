import React, { useEffect, useRef } from "react";
import { environment, LaunchType, getPreferenceValues, updateCommandMetadata, showHUD } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { setDefaultOutputDevice, setDefaultInputDevice, setDefaultSystemDevice } from "./audio-device";
import { useCurrentAudioDevices } from "./hooks/useCurrentAudioDevices";
import { useAudioDevices } from "./hooks/useAudioDevices";
import { usePriorityLists } from "./hooks/usePriorityLists";

interface Preferences {
  enableAutoSwitch: boolean;
  systemOutput: boolean;
}

function PriorityMonitorCommand() {
  const preferences = getPreferenceValues<Preferences>();
  const isBackground = environment.launchType === LaunchType.Background;

  const [cachedOutputUID, setCachedOutputUID] = useCachedState<string | undefined>("priority-monitor-output-uid");
  const [cachedInputUID, setCachedInputUID] = useCachedState<string | undefined>("priority-monitor-input-uid");
  const shouldExecuteHeavy = useRef<boolean>(false);

  const { currentDevices, currentDevicesIsLoading } = useCurrentAudioDevices();

  const { devices, devicesIsLoading } = useAudioDevices({
    options: { execute: shouldExecuteHeavy.current },
  });

  const { priorityLists, priorityListsIsLoading } = usePriorityLists();

  useEffect(() => {
    if (!currentDevices) return;

    if (!preferences.enableAutoSwitch) {
      shouldExecuteHeavy.current = false;
      updateCommandMetadata({ subtitle: "Auto-switch disabled" });
      return;
    }

    const outputChanged = currentDevices.output?.uid !== cachedOutputUID;
    const inputChanged = currentDevices.input?.uid !== cachedInputUID;

    if (outputChanged || inputChanged || !cachedOutputUID) {
      shouldExecuteHeavy.current = true;
    } else {
      shouldExecuteHeavy.current = false;
      const outputName = currentDevices.output?.name || "None";
      const inputName = currentDevices.input?.name || "None";
      updateCommandMetadata({
        subtitle: `Active: ${outputName} | ${inputName}`,
      });
    }
  }, [currentDevices, cachedOutputUID, cachedInputUID, preferences.enableAutoSwitch]);

  useEffect(() => {
    if (!shouldExecuteHeavy.current || !devices || !priorityLists || !currentDevices) {
      return;
    }

    if (!isBackground || !preferences.enableAutoSwitch) {
      return;
    }

    const getHighestPriorityDevice = (deviceList: any[], priorityList: string[]) => {
      let highestPriorityDevice = null;
      let highestPriorityRank = Infinity;

      for (const device of deviceList) {
        const priorityIndex = priorityList.findIndex((name) => name.toLowerCase() === device.name.toLowerCase());

        if (priorityIndex !== -1) {
          const rank = priorityIndex + 1;
          if (rank < highestPriorityRank) {
            highestPriorityRank = rank;
            highestPriorityDevice = device;
          }
        }
      }

      return highestPriorityDevice;
    };

    const performDeviceSwitch = async () => {
      try {
        const switchedDevices: string[] = [];

        const topOutputDevice = getHighestPriorityDevice(devices.output, priorityLists.output);
        const topInputDevice = getHighestPriorityDevice(devices.input, priorityLists.input);

        if (topOutputDevice && currentDevices.output && currentDevices.output.uid !== topOutputDevice.uid) {
          try {
            await setDefaultOutputDevice(topOutputDevice.id);
            if (preferences.systemOutput) {
              await setDefaultSystemDevice(topOutputDevice.id);
            }
            setCachedOutputUID(topOutputDevice.uid);
            switchedDevices.push(`Output: ${topOutputDevice.name}`);
          } catch (error) {
            console.log("Failed to switch output device:", error);
          }
        } else if (currentDevices.output) {
          setCachedOutputUID(currentDevices.output.uid);
        }

        if (topInputDevice && currentDevices.input && currentDevices.input.uid !== topInputDevice.uid) {
          try {
            await setDefaultInputDevice(topInputDevice.id);
            setCachedInputUID(topInputDevice.uid);
            switchedDevices.push(`Input: ${topInputDevice.name}`);
          } catch (error) {
            console.log("Failed to switch input device:", error);
          }
        } else if (currentDevices.input) {
          setCachedInputUID(currentDevices.input.uid);
        }

        if (switchedDevices.length > 0) {
          showHUD(`Auto-switched to ${switchedDevices.join(", ")}`);
        }

        const outputStatus = topOutputDevice ? topOutputDevice.name : "None";
        const inputStatus = topInputDevice ? topInputDevice.name : "None";

        await updateCommandMetadata({
          subtitle: `Priority: ${outputStatus} | ${inputStatus}`,
        });
      } catch (error) {
        console.log("Priority monitor error:", error);
        await updateCommandMetadata({ subtitle: "Error checking priorities" });
      }
    };

    performDeviceSwitch();
  }, [
    devices,
    priorityLists,
    currentDevices,
    isBackground,
    preferences.enableAutoSwitch,
    preferences.systemOutput,
    setCachedOutputUID,
    setCachedInputUID,
  ]);

  const isLoading = currentDevicesIsLoading || devicesIsLoading || priorityListsIsLoading;

  if (isLoading && !currentDevices) {
    updateCommandMetadata({ subtitle: "Loading..." });
  }

  return null;
}

export default function Command() {
  return <PriorityMonitorCommand />;
}
