"use client";

import { useEffect, useState } from "react";
import { useWebSocketContext } from "@/hooks/websocket/WebsocketProvider";
import type { DeviceMessage } from "@/store/slices/devices/devices.interface";

/** Latest SCREEN_FRAME (base64 JPEG) pushed for this device over the plain
 *  control WebSocket — no WebRTC, no upload/URL round trip. Kept out of
 *  Redux since frames arrive every ~800ms and are only ever needed by
 *  whichever component is showing this one device right now. */
export function useLiveScreenFrame(deviceId: string | null) {
  const { addListener, removeListener } = useWebSocketContext();
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    setFrame(null);
    if (!deviceId) return;

    const onMessage = (msg: DeviceMessage) => {
      if (msg.type === "SCREEN_FRAME" && msg.deviceId === deviceId) {
        setFrame(msg.data as string);
      }
    };

    addListener(onMessage);
    return () => removeListener(onMessage);
  }, [deviceId, addListener, removeListener]);

  return frame;
}

export default useLiveScreenFrame;
