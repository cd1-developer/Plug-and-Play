import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  AutomationState,
  DeviceMessage,
  DeviceState,
  LogEntry,
} from "./devices.interface";

type DevicesState = Record<string, DeviceState>;
const initialState: DevicesState = {};

const emptyAutomation: AutomationState = {
  status: "IDLE",
  totalOperations: 0,
  completedOperations: 0,
  remainingOperations: 0,
  updatedAt: 0,
};

const MAX_LOGS = 500;

const devicesSlice = createSlice({
  name: "devices",
  initialState,
  reducers: {
    /** Route by message type — no blind merging of heterogeneous payloads. */
    deviceMessage: (state, action: PayloadAction<DeviceMessage>) => {
      const msg = action.payload;
      if (!msg.deviceId) return;
      const device = (state[msg.deviceId] ??= { deviceId: msg.deviceId });

      switch (msg.type) {
        case "AUTOMATION_STATE": {
          const { type, deviceId, ...automation } = msg;
          device.automation = {
            ...emptyAutomation,
            ...(automation as Partial<AutomationState>),
          };
          break;
        }
        case "DEVICE_CONN":
          device.connection = {
            online: Boolean(msg.online),
            lastSeen: Number(msg.lastSeen),
          };
          break;
        case "LOG": {
          const entry = {
            message: msg.message as string,
            timestamp: Number(msg.timestamp),
          };

          const logs = device.logs ?? [];
          // Skip if it's the same message as the last one — collapses
          // back-to-back repeats (e.g. a heartbeat) without losing history.
          if (logs[logs.length - 1]?.message === entry.message) break;

          device.logs = [...logs, entry].slice(-MAX_LOGS);
          break;
        }
        case "LOGS_SNAPSHOT": {
          device.logs = msg.logs as LogEntry[];
          break;
        }
        case "SCRAPED_INFO":
          device.scrape = {
            currentUsername: msg.currentUsername as string | null,
            totalScrape: msg.totalScrape as number,
            scrapeCount: msg.scrapeCount as number,
            scrapeAccounts: msg.scrapeAccounts as string[],
          };
          break;

        // OPEN_STATUS / status / result are live-only: never stored.
      }
    },
    /** Optimistic local patch (start/stop) until the device's snapshot lands. */
    patchAutomation: (
      state,
      action: PayloadAction<{ deviceId: string } & Partial<AutomationState>>,
    ) => {
      const { deviceId, ...patch } = action.payload;
      const device = state[deviceId];
      if (!device) return;
      device.automation = {
        ...emptyAutomation,
        ...device.automation,
        ...patch,
      };
    },
    clearDevices: () => ({}),
    clearDeviceLogs: (state, action: PayloadAction<string>) => {
      const device = state[action.payload];
      if (device) device.logs = [];
    },
  },
});

export const { deviceMessage, patchAutomation, clearDevices, clearDeviceLogs } =
  devicesSlice.actions;
export default devicesSlice.reducer;
