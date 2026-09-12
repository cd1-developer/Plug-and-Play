import { NextRequest, NextResponse } from "next/server";
import { locationService } from "@/utils/service/LocationService";
import { VPNApp } from "@/utils/vpnApp";

export async function POST(request: NextRequest) {
  const { city, vpnApp } = await request.json();

  if (!city || !Object.values(VPNApp).includes(vpnApp)) {
    return NextResponse.json(
      { error: "city and vpnApp are required" },
      { status: 400 },
    );
  }

  try {
    const locations = await locationService.getClosestVpnLocations(
      city,
      vpnApp,
    );
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching closest VPN locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch closest VPN locations" },
      { status: 500 },
    );
  }
}
