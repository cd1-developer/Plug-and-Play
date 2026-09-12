import axiosInstance from "@/libs/AxiosInstance";
import { Placement } from "../types/placemenet.interface";
import { ServiceResult } from "@/comman/interfaces";

class PlacementApi {
  private readonly endpoint = "/placements";
  /** Device connected, no client account assigned yet — ready to log in. */
  async getUnassigned(): Promise<ServiceResult<Placement[]>> {
    try {
      const { data } = await axiosInstance.get(`${this.endpoint}/unassigned`);
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to fetch unassigned placements",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.error ??
          "Failed to fetch unassigned placements",
      };
    }
  }

  /** Placements that already have a client account — used to look up which
   *  device/placement belongs to a given clientAccountId. */
  async getAssigned(): Promise<ServiceResult<Placement[]>> {
    try {
      const { data } = await axiosInstance.get(`${this.endpoint}`);
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to fetch placements",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error ?? "Failed to fetch placements",
      };
    }
  }
}
// export a single instance — no need to instantiate it everywhere
export const placementApi = new PlacementApi();
