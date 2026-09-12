import axiosInstance from "@/libs/AxiosInstance";
import { ServiceResult } from "@/comman/interfaces";
import { ClientAccount } from "../types/client-account.interface";

class ClientAccountApi {
  private readonly endpoint = "/client-accounts";

  /** Create-only: fails if the placement already has a client account, or if
   *  igUsername isn't globally unique. Always HTTP 200 — the body's `success`
   *  flag is the real result, not the status code. */
  async assign(
    placementId: string,
    igUsername: string,
  ): Promise<ServiceResult<ClientAccount>> {
    try {
      const { data } = await axiosInstance.post(
        `${this.endpoint}/${placementId}/assign`,
        { igUsername },
      );
      if (!data.success) {
        return { success: false, message: data.message ?? "Assign failed" };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message ?? "Failed to assign placement",
      };
    }
  }
}
// export a single instance — no need to instantiate it everywhere
export const clientAccountApi = new ClientAccountApi();
