"use client";
import { useMutation } from "@tanstack/react-query";
import { VPNApp } from "@/utils/vpnApp";
import { ErrorToast } from "@/components/Toasts";
import type { RankedVpnLocation } from "@/utils/service/LocationService";
import axios from "axios";

async function fetchClosestVpnLocations(
  city: string,
  vpnApp: VPNApp,
): Promise<RankedVpnLocation[]> {
  const response = await axios.post<RankedVpnLocation[]>(
    "/api/vpn-locations/closest",
    {
      city,
      vpnApp,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

function useLocation() {
  const closestVpnLocationsMutation = useMutation({
    mutationFn: ({ city }: { city: string }) =>
      fetchClosestVpnLocations(city, VPNApp.MULLVAD),
    onError: () => ErrorToast("Failed to fetch closest VPN locations"),
  });

  return {
    getClosestVpnLocations: closestVpnLocationsMutation.mutateAsync,
    closestVpnLocations: closestVpnLocationsMutation.data ?? [],
    isLoadingClosestVpnLocations: closestVpnLocationsMutation.isPending,
  };
}

export default useLocation;
