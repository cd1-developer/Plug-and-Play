import type { DeviceState } from "@/store/slices/devices/devices.interface";
import type { Placement } from "../types/placemenet.interface";

/** Connectivity is its own dimension — server-owned, never inferred from message types. */
export function isDeviceConnected(device: DeviceState | undefined): boolean {
  return device?.connection?.online === true;
}

/** Light, theme-agnostic (alpha-blended) green — reads fine over both light and dark cell backgrounds. */
export const CONNECTED_ROW_THEME = { bgCell: "rgba(34, 197, 94, 0.14)" };

export function isActionRequired(device: DeviceState | undefined): boolean {
  return device?.automation?.status === "ACTION_REQUIRED";
}

export type PlacementWithDeviceStatus = Placement & {
  /** Live, from the devices websocket — not the REST response. */
  connected: boolean;
  /** Already mid-automation — can't be picked for another run. */
  isRunning: boolean;
};

/** Merge REST placements with their live connection/automation state from the
 *  devices slice — shared by both the unassigned- and assigned-placements hooks. */
export function withDeviceStatus(
  placements: Placement[],
  devices: Record<string, DeviceState>,
): PlacementWithDeviceStatus[] {
  return placements.map((placement) => {
    const device = placement.deviceId ? devices[placement.deviceId] : undefined;
    return {
      ...placement,
      connected: isDeviceConnected(device),
      isRunning: isAutomationRunning(device),
    };
  });
}

/** Device is mid-automation — can't be picked for another run until it finishes. */
export function isAutomationRunning(device: DeviceState | undefined): boolean {
  const status = device?.automation?.status;
  return status === "RUNNING" || status === "STARTING";
}

/** Same alpha-blended pattern as CONNECTED_ROW_THEME, red instead of green. */
export const ACTION_REQUIRED_ROW_THEME = { bgCell: "rgba(220, 38, 38, 0.18)" };
