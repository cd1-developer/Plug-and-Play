import { useEffect, useState } from "react";
import { placementApi } from "../api/placement.api";
import { useAppDispatch, useAppSelector } from "@/store/storeConfig";
import { setUnassignedPlacements } from "@/store/slices/placements/placements.slice";
import {
  withDeviceStatus,
  type PlacementWithDeviceStatus,
} from "../utils/placement-device-status";

export type UnassignedPlacement = PlacementWithDeviceStatus;

interface UseUnassignedPlacementsOptions {
  /** Fetch only when needed (e.g. dialog open). */
  enabled?: boolean;
}

/** Placements with a device connected but no client account yet — ready to
 *  attempt a login. Cached in Redux (not localStorage): the API is only
 *  called when `state.placements.unassigned` is still `null`. */
function useUnassignedPlacements({
  enabled = true,
}: UseUnassignedPlacementsOptions = {}) {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((state) => state.devices);
  const cached = useAppSelector((state) => state.placements.unassigned);
  const [isLoading, setIsLoading] = useState(enabled && cached === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || cached !== null) return;
    let cancelled = false;
    setIsLoading(true);
    placementApi.getUnassigned().then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (result.success) {
        dispatch(setUnassignedPlacements(result.data ?? []));
      } else {
        setError(result.message ?? "Failed to fetch unassigned placements");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, cached, dispatch]);

  return {
    unassignedPlacements: withDeviceStatus(cached ?? [], devices),
    isLoading,
    error,
  };
}

export default useUnassignedPlacements;
