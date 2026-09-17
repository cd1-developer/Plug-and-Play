"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/storeConfig";
import { deviceMessage } from "@/store/slices/devices/devices.slice";
import { DeviceMessage } from "@/store/slices/devices/devices.interface";
import { getAccessToken } from "@/libs/AxiosInstance";

function useWebsocket() {
  const dispatch = useAppDispatch();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const listeners = useRef<Set<(msg: DeviceMessage) => void>>(new Set());
  useEffect(() => {
    let ws: WebSocket;
    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (cancelled) return;

      const url = new URL(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);
      if (token) url.searchParams.set("token", token);
      ws = new WebSocket(url);

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
      cancelled = true;

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
