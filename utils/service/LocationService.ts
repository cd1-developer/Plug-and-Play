import { locationApi, VPNApp } from "../LocationApi";

export interface RankedVpnLocation {
  country: string;
  city: string;
  lat: number;
  lon: number;
  distance: number;
}

class LocationService {
  // 1. Helper function to convert degrees to radians

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  // 2. Haversine formula to calculate distance from coordinates
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371; // Earth's radius in km (use 3959 for miles)
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Merge sort, ascending by distance
  private mergeSort(locations: RankedVpnLocation[]): RankedVpnLocation[] {
    if (locations.length <= 1) return locations;

    const mid = Math.floor(locations.length / 2);
    const left = this.mergeSort(locations.slice(0, mid));
    const right = this.mergeSort(locations.slice(mid));

    return this.merge(left, right);
  }

  private merge(
    left: RankedVpnLocation[],
    right: RankedVpnLocation[],
  ): RankedVpnLocation[] {
    const merged: RankedVpnLocation[] = [];
    let i = 0;
    let j = 0;

    while (i < left.length && j < right.length) {
      if (left[i].distance <= right[j].distance) {
        merged.push(left[i++]);
      } else {
        merged.push(right[j++]);
      }
    }

    return merged.concat(left.slice(i), right.slice(j));
  }

  async getClosestVpnLocations(
    city: string,
    vpnApp: VPNApp,
  ): Promise<RankedVpnLocation[]> {
    const origin = await locationApi.getLocation(city);
    const vpnLocations = await locationApi.getVpnLocations(vpnApp);

    const ranked: RankedVpnLocation[] = vpnLocations.flatMap((entry) =>
      entry.countries.cities.map((vpnCity) => ({
        country: entry.countries.name,
        city: vpnCity.name,
        lat: vpnCity.lat,
        lon: vpnCity.lon,
        distance: this.calculateDistance(
          origin.lat,
          origin.lon,
          vpnCity.lat,
          vpnCity.lon,
        ),
      })),
    );

    return this.mergeSort(ranked).slice(0, 5);
  }
}

export const locationService = new LocationService();
