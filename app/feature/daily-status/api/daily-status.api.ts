import axiosInstance from "@/libs/AxiosInstance";
import { ServiceResult } from "@/comman/interfaces";
import { DailyActivityStatus, DailyStatus } from "../types/daily-status.interface";

const NO_STATUS_YET_MESSAGE = "No daily status found for this client account";

class DailyStatusApi {
  private readonly endpoint = "/daily-status";

  /** Create-or-update the one (clientAccountId, date) row. Always HTTP 200 —
   *  the body's `success` flag is the real result, not the status code. */
  async upsert(
    clientAccountId: string,
    date: string,
    status: DailyActivityStatus,
  ): Promise<ServiceResult<DailyStatus>> {
    try {
      const { data } = await axiosInstance.post(
        `${this.endpoint}/${clientAccountId}`,
        { date, status },
      );
      if (!data.success) {
        return { success: false, message: data.message ?? "Failed to update status" };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message ?? "Failed to update status",
      };
    }
  }

  /** Most recent status row. A valid client with no history yet also comes
   *  back as `success: false` — treated here as "no data yet", not an error. */
  async getLatest(
    clientAccountId: string,
  ): Promise<ServiceResult<DailyStatus | undefined>> {
    try {
      const { data } = await axiosInstance.get(`${this.endpoint}/${clientAccountId}`);
      if (!data.success) {
        if (data.message === NO_STATUS_YET_MESSAGE) {
          return { success: true, data: undefined };
        }
        return { success: false, message: data.message ?? "Failed to fetch status" };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message ?? "Failed to fetch status",
      };
    }
  }
}
// export a single instance — no need to instantiate it everywhere
export const dailyStatusApi = new DailyStatusApi();
