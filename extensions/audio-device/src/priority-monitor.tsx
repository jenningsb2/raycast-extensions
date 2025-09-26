import {
  environment,
  LaunchType,
  getPreferenceValues,
  updateCommandMetadata,
  showHUD,
  LocalStorage,
} from "@raycast/api";
import {
  getOutputDevices,
  getInputDevices,
  getDefaultOutputDevice,
  getDefaultInputDevice,
  setDefaultOutputDevice,
  setDefaultInputDevice,
  setDefaultSystemDevice,
} from "./audio-device";
import {
  getOutputPriorityList,
  getInputPriorityList,
  isPriorityListDirty,
  clearPriorityListDirty,
} from "./priority-utils";

interface Preferences {
  enableAutoSwitch: boolean;
  systemOutput: boolean;
}

interface CachedState {
  outputUID?: string;
  inputUID?: string;
  outputPriorityList?: string[];
  inputPriorityList?: string[];
  lastUpdate?: number;
}

const CACHE_KEY = "priority-monitor-state";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function PriorityMonitor() {
  const preferences = getPreferenceValues<Preferences>();
  const isBackground = environment.launchType === LaunchType.Background;

  try {
    // Early exit if auto-switch is disabled
    if (!preferences.enableAutoSwitch) {
      await updateCommandMetadata({ subtitle: "Auto-switch disabled" });
      return;
    }

    // Load cached state
    const cachedStateStr = await LocalStorage.getItem<string>(CACHE_KEY);
    const cachedState: CachedState = cachedStateStr ? JSON.parse(cachedStateStr) : {};

    // STEP 1: Check dirty flags (minimal memory read)
    const [outputDirty, inputDirty] = await Promise.all([
      isPriorityListDirty(true),
      isPriorityListDirty(false),
    ]);

    const priorityListChanged = outputDirty || inputDirty;
    const cacheExpired = !cachedState.lastUpdate || Date.now() - cachedState.lastUpdate > CACHE_TTL;

    // STEP 2: Lightweight check - get current devices (fast)
    const [currentOutput, currentInput] = await Promise.all([
      getDefaultOutputDevice().catch(() => null),
      getDefaultInputDevice().catch(() => null),
    ]);

    if (!currentOutput || !currentInput) {
      await updateCommandMetadata({ subtitle: "No audio devices found" });
      return;
    }

    // STEP 3: Fast path - if nothing dirty and cache fresh, verify current devices match cached top priority
    if (!priorityListChanged && !cacheExpired) {
      const outputMatches = currentOutput.uid === cachedState.outputUID;
      const inputMatches = currentInput.uid === cachedState.inputUID;

      if (outputMatches && inputMatches) {
        await updateCommandMetadata({
          subtitle: `Active: ${currentOutput.name} | ${currentInput.name}`,
        });
        return;
      }
    }

    // STEP 4: Something changed or cache expired - do the expensive work
    const [outputDevices, inputDevices, outputPriorityList, inputPriorityList] = await Promise.all([
      getOutputDevices().catch(() => []),
      getInputDevices().catch(() => []),
      getOutputPriorityList().catch(() => []),
      getInputPriorityList().catch(() => []),
    ]);

    if (outputDevices.length === 0 || inputDevices.length === 0) {
      await updateCommandMetadata({ subtitle: "No devices available" });
      return;
    }

    // STEP 5: Find highest priority devices
    const getHighestPriorityDevice = (devices: any[], priorityList: string[]) => {
      let highestPriorityDevice = null;
      let highestPriorityRank = Infinity;

      for (const device of devices) {
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

    const topOutputDevice = getHighestPriorityDevice(outputDevices, outputPriorityList);
    const topInputDevice = getHighestPriorityDevice(inputDevices, inputPriorityList);

    // STEP 6: Perform switching if needed and we're in background
    const switchedDevices: string[] = [];

    if (isBackground && preferences.enableAutoSwitch) {
      // Check output device
      if (topOutputDevice && currentOutput.uid !== topOutputDevice.uid) {
        try {
          await setDefaultOutputDevice(topOutputDevice.id);
          if (preferences.systemOutput) {
            await setDefaultSystemDevice(topOutputDevice.id);
          }
          switchedDevices.push(`Output: ${topOutputDevice.name}`);
        } catch (error) {
          console.log("Failed to switch output device:", error);
        }
      }

      // Check input device
      if (topInputDevice && currentInput.uid !== topInputDevice.uid) {
        try {
          await setDefaultInputDevice(topInputDevice.id);
          switchedDevices.push(`Input: ${topInputDevice.name}`);
        } catch (error) {
          console.log("Failed to switch input device:", error);
        }
      }

      // Show notification if we switched devices
      if (switchedDevices.length > 0) {
        showHUD(`Auto-switched to ${switchedDevices.join(", ")}`);
      }
    }

    // STEP 7: Update cache with new state and clear dirty flags
    const newState: CachedState = {
      outputUID: topOutputDevice?.uid || currentOutput.uid,
      inputUID: topInputDevice?.uid || currentInput.uid,
      outputPriorityList,
      inputPriorityList,
      lastUpdate: Date.now(),
    };

    await Promise.all([
      LocalStorage.setItem(CACHE_KEY, JSON.stringify(newState)),
      outputDirty ? clearPriorityListDirty(true) : Promise.resolve(),
      inputDirty ? clearPriorityListDirty(false) : Promise.resolve(),
    ]);

    // STEP 8: Update command metadata
    const outputStatus = topOutputDevice ? topOutputDevice.name : currentOutput.name;
    const inputStatus = topInputDevice ? topInputDevice.name : currentInput.name;

    await updateCommandMetadata({
      subtitle: preferences.enableAutoSwitch ? `Priority: ${outputStatus} | ${inputStatus}` : "Auto-switch disabled",
    });
  } catch (error) {
    console.log("Priority monitor error:", error);
    await updateCommandMetadata({ subtitle: "Error checking priorities" });
  }
}
