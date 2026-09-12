import axiosInstance from "@/libs/AxiosInstance";
import { ServiceResult } from "@/comman/interfaces";
import {
  GrowthStrategy,
  GrowthStrategyPayload,
} from "../types/growth-strategy.interface";

class GrowthStrategyApi {
  private readonly endpoint = "/growth-strategy";

  async create(
    username: string,
    payload: GrowthStrategyPayload,
  ): Promise<ServiceResult<GrowthStrategy>> {
    try {
      const { data } = await axiosInstance.post(
        `${this.endpoint}/${username}`,
        payload,
      );
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to save growth strategy",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.error ?? "Failed to save growth strategy",
      };
    }
  }
  async getAll(): Promise<ServiceResult<GrowthStrategy[]>> {
    try {
      const { data } = await axiosInstance.get(`${this.endpoint}`);
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to fetch growth strategies",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.error ?? "Failed to save growth strategy",
      };
    }
  }

  async get(username: string): Promise<ServiceResult<GrowthStrategy>> {
    try {
      const { data } = await axiosInstance.get(`${this.endpoint}/${username}`);
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to fetch growth strategy",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.error ?? "Failed to save growth strategy",
      };
    }
  }
}
// export a single instance — no need to instantiate it everywhere
export const growthStrategyApi = new GrowthStrategyApi();
