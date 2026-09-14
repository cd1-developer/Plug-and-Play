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

  /** The placement/device linked to one clientAccountId, if any — a direct
   *  lookup rather than fetching every placement and filtering client-side. */
  async getByClientAccountId(
    clientAccountId: string,
  ): Promise<ServiceResult<Placement | null>> {
    try {
      const { data } = await axiosInstance.get(
        `${this.endpoint}/by-client-account/${clientAccountId}`,
      );
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to fetch placement",
        };
      }
      return { success: true, data: data.data ?? null };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error ?? "Failed to fetch placement",
      };
    }
  }
}
// export a single instance — no need to instantiate it everywhere
export const placementApi = new PlacementApi();
