import { useQuery } from "@tanstack/react-query";
import { placementApi } from "../api/placement.api";
import { useAppSelector } from "@/store/storeConfig";
import {
  withDeviceStatus,
  type PlacementWithDeviceStatus,
} from "../utils/placement-device-status";

export type AssignedPlacement = PlacementWithDeviceStatus;

/** Placements that already have a client account — the only way to resolve
 *  "which device belongs to this growth strategy's clientAccountId" since no
 *  API takes a clientAccountId directly (see Placement.clientAccountId). */
function useAssignedPlacements() {
  const query = useQuery({
    queryKey: ["placements", "assigned"],
    queryFn: () => placementApi.getAssigned(),
  });
  const devices = useAppSelector((state) => state.devices);
  const placements = query.data?.success ? (query.data.data ?? []) : [];

  return {
    assignedPlacements: withDeviceStatus(placements, devices),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export default useAssignedPlacements;
