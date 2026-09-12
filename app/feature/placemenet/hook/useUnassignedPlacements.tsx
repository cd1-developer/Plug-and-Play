import { useQuery } from "@tanstack/react-query";
import { placementApi } from "../api/placement.api";
import { useAppSelector } from "@/store/storeConfig";
import {
  withDeviceStatus,
  type PlacementWithDeviceStatus,
} from "../utils/placement-device-status";

export type UnassignedPlacement = PlacementWithDeviceStatus;

interface UseUnassignedPlacementsOptions {
  /** Fetch only when needed (e.g. dialog open). */
  enabled?: boolean;
}

/** Placements with a device connected but no client account yet — ready to attempt a login. */
function useUnassignedPlacements({
  enabled = true,
}: UseUnassignedPlacementsOptions = {}) {
  const query = useQuery({
    queryKey: ["placements", "unassigned"],
    queryFn: () => placementApi.getUnassigned(),
    enabled,
  });
  const devices = useAppSelector((state) => state.devices);
  const placements = query.data?.success ? (query.data.data ?? []) : [];

  return {
    unassignedPlacements: withDeviceStatus(placements, devices),
    isLoading: query.isLoading,
    error: query.data?.success === false ? query.data.message : null,
  };
}

export default useUnassignedPlacements;
