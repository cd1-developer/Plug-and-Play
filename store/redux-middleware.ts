import type { Middleware, UnknownAction } from "@reduxjs/toolkit";

type BroadcastMeta = {
  fromBroadcast?: boolean;
};

type BroadcastAction = UnknownAction & {
  meta?: BroadcastMeta;
};

const CHANNEL_NAME = "redux-sync";

// Only these slices/actions sync across tabs. Also a hard requirement, not
// just scoping: postMessage uses structured clone, and redux-persist's
// internal actions (persist/REGISTER, persist/PERSIST) carry
// `register`/`rehydrate` functions in their payload, which throws
// DataCloneError.
const SYNCED_PREFIXES = [
  "dailyActivity/",
  // Only this one placement action — not the whole "PlacementSlice/" prefix,
  // since e.g. setPlacements/addPlacement are already driven by each tab's
  // own fetch and shouldn't be clobbered by another tab's copy.
  "PlacementSlice/updateAdditionalActivitySettings",
];

const shouldSync = (type: unknown) =>
  typeof type === "string" &&
  SYNCED_PREFIXES.some((prefix) => type.startsWith(prefix));

let channel: BroadcastChannel | null = null;

export const reduxSyncMiddleware: Middleware =
  ({ dispatch }) =>
  (next) =>
  (action) => {
    const result = next(action);

    if (typeof window === "undefined") {
      return result;
    }

    const typedAction = action as BroadcastAction;

    if (!channel && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);

      channel.onmessage = (event) => {
        const incomingAction = event.data as BroadcastAction;

        if (!incomingAction?.type) {
          return;
        }

        dispatch({
          ...incomingAction,
          meta: {
            ...incomingAction.meta,
            fromBroadcast: true,
          },
        });
      };
    }

    // Don't rebroadcast actions received from another tab
    if (typedAction.meta?.fromBroadcast || !shouldSync(typedAction.type)) {
      return result;
    }

    channel?.postMessage(typedAction);

    return result;
  };
