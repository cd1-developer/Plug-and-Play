"use client";

import { createContext, useContext } from "react";
import useWebsocket from "./useWebsocket";
import type { DeviceMessage } from "@/store/slices/devices/devices.interface";

interface WebSocketContextValue {
  connected: boolean;
  socket: WebSocket | null;
  addListener: (listener: (msg: DeviceMessage) => void) => void;
  removeListener: (listener: (msg: DeviceMessage) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  socket: null,
  addListener: () => {},
  removeListener: () => {},
});

/**
 * Mounts the single shared websocket connection once and exposes it via
 * context, so consumers (e.g. a Start/Stop button in a grid cell) can send
 * on it without each opening their own connection. addListener/removeListener
 * expose every raw message (including live-only ones like SCREEN_FRAME that
 * never touch Redux) to whoever wants to watch a specific message type.
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { connected, socket, addListener, removeListener } = useWebsocket();
  return (
    <WebSocketContext.Provider
      value={{ connected, socket, addListener, removeListener }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
