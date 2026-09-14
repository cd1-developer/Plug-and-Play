import { useEffect, useState } from "react";
import { placementApi } from "../api/placement.api";
import { useAppDispatch, useAppSelector } from "@/store/storeConfig";
import { setPlacementForClientAccount } from "@/store/slices/placements/placements.slice";
import {
  isDeviceConnected,
  isAutomationRunning,
  type PlacementWithDeviceStatus,
} from "../utils/placement-device-status";

export type PlacementForClientAccount = PlacementWithDeviceStatus;

/** The placement/device linked to one clientAccountId — fetched directly via
 *  GET /placements/by-client-account/:clientAccountId, not by fetching every
 *  placement and filtering client-side. Cached in Redux (not localStorage),
 *  keyed by clientAccountId: the API is only called once per id. */
function usePlacementForClientAccount(clientAccountId: string | null) {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((state) => state.devices);
  const cached = useAppSelector((state) =>
    clientAccountId ? state.placements.byClientAccountId[clientAccountId] : undefined,
  );
  const isCached = cached !== undefined;
  const [isLoading, setIsLoading] = useState(clientAccountId !== null && !isCached);

  useEffect(() => {
    if (!clientAccountId || isCached) return;
    let cancelled = false;
    setIsLoading(true);
    placementApi.getByClientAccountId(clientAccountId).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (result.success) {
        dispatch(
          setPlacementForClientAccount({ clientAccountId, placement: result.data ?? null }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clientAccountId, isCached, dispatch]);

  const device = cached?.deviceId ? devices[cached.deviceId] : undefined;
  const placement: PlacementForClientAccount | null = cached
    ? {
        ...cached,
        connected: isDeviceConnected(device),
        isRunning: isAutomationRunning(device),
      }
    : null;

  return { placement, isLoading };
}

export default usePlacementForClientAccount;
