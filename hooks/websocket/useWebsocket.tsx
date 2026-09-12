"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/storeConfig";
import { deviceMessage } from "@/store/slices/devices/devices.slice";
import { DeviceMessage } from "@/store/slices/devices/devices.interface";

function useWebsocket() {
  const dispatch = useAppDispatch();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const listeners = useRef<Set<(msg: DeviceMessage) => void>>(new Set());
  useEffect(() => {
    let ws: WebSocket;

    const connect = () => {
      ws = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);

      ws.onopen = () => {
        console.log("Connected");
        setSocket(ws);
        setConnected(true);
      };

      ws.onmessage = (message) => {
        const data = JSON.parse(message.data) as DeviceMessage;

        if (data.deviceId) dispatch(deviceMessage(data));
        listeners.current.forEach((listener) => listener(data));
      };

      ws.onclose = () => {
        console.log("Disconnected");

        setConnected(false);
        setSocket(null);

        reconnectTimeout.current = setTimeout(() => {
          console.log("Reconnecting...");
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      ws?.close();
    };
  }, [dispatch]);

  const addListener = useCallback((listener: (msg: DeviceMessage) => void) => {
    listeners.current.add(listener);
  }, []);

  const removeListener = useCallback(
    (listener: (msg: DeviceMessage) => void) => {
      listeners.current.delete(listener);
    },
    [],
  );

  return {
    connected,
    socket,
    addListener,
    removeListener,
  };
}

export default useWebsocket;
