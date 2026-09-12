import axios from "axios";
import redisClient from "@/libs/RedisClient";
import { VPNApp } from "@/utils/vpnApp";

const MULLVAD_RELAYS_URL =
  "https://api.mullvad.net/public/relays/wireguard/v1/";
const CACHE_TTL_SECONDS = 172800; // 48 hours

export { VPNApp };

interface City {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
}

interface MullvadCountry {
  name: string;
  code: string;
  cities: City[];
}

interface MullvadRelaysResponse {
  countries: MullvadCountry[];
}

export interface VpnCity {
  name: string;
  lat: number;
  lon: number;
}

export interface VpnCountry {
  name: string;
  cities: VpnCity[];
}

export interface VpnLocationEntry {
  countries: VpnCountry;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

class LocationApi {
  private async getCoordinates(cityName: string): Promise<Coordinates> {
    const url = process.env.NEXT_PUBLIC_LOCATION_API_ENDPOINT!;
    const params = {
      q: cityName,
      format: "json",
      limit: 1,
    };
    try {
      const response = await axios.get(url, {
        params,
        headers: { "User-Agent": "CityDistanceCalculatorApp/1.0" }, // OSM requires a User-Agent header
      });
      const data = await response.data;

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      } else {
        throw new Error(`City not found: ${cityName}`);
      }
    } catch (error) {
      console.error("Error fetching coordinates:", error);
      throw error;
    }
  }
  private async getMullvadLocations(): Promise<VpnLocationEntry[]> {
    let countries: MullvadCountry[];
    try {
      const { data } =
        await axios.get<MullvadRelaysResponse>(MULLVAD_RELAYS_URL);
      countries = data.countries;
    } catch (error) {
      console.error("Error fetching Mullvad relays:", error);
      throw error;
    }

    if (!Array.isArray(countries)) {
      throw new Error(
        "Invalid Mullvad relay response: missing countries array",
      );
    }

    return countries.map((country) => ({
      countries: {
        name: country.name,
        cities: (country.cities ?? []).map((city) => ({
          name: city.name,
          lat: city.latitude,
          lon: city.longitude,
        })),
      },
    }));
  }

  async getVpnLocations(vpnApp: VPNApp): Promise<VpnLocationEntry[]> {
    try {
      const cached = await redisClient.get(vpnApp);
      if (cached) {
        return JSON.parse(cached) as VpnLocationEntry[];
      }
    } catch (error) {
      console.error(
        `Error reading VPN locations from Redis (key: ${vpnApp}):`,
        error,
      );
      throw error;
    }

    const locations = await this.getMullvadLocations();

    try {
      await redisClient.set(
        vpnApp,
        JSON.stringify(locations),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      console.error(
        `Error writing VPN locations to Redis (key: ${vpnApp}):`,
        error,
      );
      throw error;
    }

    return locations;
  }

  async getLocation(city: string): Promise<Coordinates> {
    const key = `client_location_${city.trim().toLowerCase()}`;

    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as Coordinates;
      }
    } catch (error) {
      console.error(`Error reading location from Redis (key: ${key}):`, error);
      throw error;
    }

    const coordinates = await this.getCoordinates(city);

    try {
      await redisClient.set(
        key,
        JSON.stringify(coordinates),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      console.error(`Error writing location to Redis (key: ${key}):`, error);
      throw error;
    }

    return coordinates;
  }
}
export const locationApi = new LocationApi();
