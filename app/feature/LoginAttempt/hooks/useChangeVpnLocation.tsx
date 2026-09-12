"use client";

import { useCallback } from "react";
import { useWebSocketContext } from "@/hooks/websocket/WebsocketProvider";
import { useAppDispatch } from "@/store/storeConfig";
import { patchAutomation } from "@/store/slices/devices/devices.slice";
import { ErrorToast } from "@/components/Toasts";
import { AutomationType } from "@/comman/AutomationType";

export interface ChangeVpnLocationCommand {
  deviceId: string;
  vpnLocation: string;
}

/** Sends a "Change Vpn Location" command over the shared websocket connection —
 *  used to switch the device to the VPN location picked before an Attempt Login.
 *  Optimistically patches status to STARTING so a stale COMPLETED snapshot from
 *  a previous run on the same device can't be mistaken for this one finishing. */
export function useChangeVpnLocation() {
  const { socket, connected } = useWebSocketContext();
  const dispatch = useAppDispatch();

  const changeVpnLocation = useCallback(
    (command: ChangeVpnLocationCommand) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        ErrorToast("Not connected to the automation server");
        return;
      }
      socket.send(
        JSON.stringify({
          status: "START",
          automationType: "Change Vpn Location" as AutomationType,
          deviceId: command.deviceId,
          vpnLocation: command.vpnLocation,
        }),
      );
      dispatch(
        patchAutomation({
          deviceId: command.deviceId,
          status: "STARTING",
          automationType: "Change Vpn Location",
        }),
      );
    },
    [socket, dispatch],
  );

  return { connected, changeVpnLocation };
}

export default useChangeVpnLocation;
