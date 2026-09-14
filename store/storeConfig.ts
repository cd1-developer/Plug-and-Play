import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { createMigrate, persistReducer, persistStore } from "redux-persist";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import storage from "redux-persist/lib/storage";
import devicesReducer from "./slices/devices/devices.slice";
import placementsReducer from "./slices/placements/placements.slice";

import { reduxSyncMiddleware } from "./redux-middleware";

// `clientTarget` moved from a flat `{ clientTargets: [] }` shape to a keyed
// `{ byClientAccountId: {} }` map. Without a version bump, redux-persist
// restores old persisted blobs verbatim over the slice's new default state,
// so `byClientAccountId` is simply missing and reading it throws. Both
// slices here are pure re-fetchable caches, so the fix is just to drop any
// pre-v1 persisted copy rather than attempt to transform an incompatible
// shape.
const migrations = {
  1: (state: any) => ({
    ...state,
    clientTarget: undefined,
    dailyActivity: undefined,
  }),
  // v2: stop persisting the server caches entirely — thousands of nested rows
  // blew the localStorage quota. They re-fetch on mount anyway; drop any
  // already-persisted copy so the oversized blob shrinks on the next write.
  2: (state: any) => ({
    ...state,
    clientTarget: undefined,
    dailyActivity: undefined,
  }),
  // v3: re-persist dailyActivity now that its slice self-prunes on every
  // write (see pruneStaleWeeks in dailyActivity.slice.ts) — only today's and
  // future weeks are ever kept, so the quota blowup from v2 can't recur.
  // v4: `placements` grew a new `assignedClientAccountIds` field. A pre-v4
  // persisted blob lacks it, and autoMergeLevel1 hard-sets any key still
  // *present* on the inbound state (even `undefined`) over the freshly
  // computed default — so `placements: undefined` is NOT the same as
  // omitting the key; it would still stomp the real default with undefined
  // and crash on `state.placements.placements`. Destructure it away instead
  // so the key is actually absent and autoMergeLevel1 leaves the reducer's
  // own (now-updated) default state alone. `placements.placements` itself is
  // a re-fetchable cache (see usePlacementManager), so losing it is fine.
  4: ({ placements: _placements, ...rest }: any) => rest,
};

const persistConfig = {
  key: "root",
  version: 4,
  storage,
  // Nothing is persisted: `placements` below is an in-memory-only cache (never
  // localStorage) — this whitelist must stay empty or that name would collide
  // with the stale v4 migration's key and start persisting it silently.
  whitelist: [],
  migrate: createMigrate(migrations, { debug: false }),
};

const rootReducer = combineReducers({
  devices: devicesReducer,
  placements: placementsReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(
      reduxSyncMiddleware,
    ),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
