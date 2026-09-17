import axios from "axios";
import { ServiceResult } from "@/comman/interfaces";
import { API_BASE_URL } from "@/constants";
import { AccessTokenResponse } from "@/store/slices/AccessToken/access-token.interface";
class AccessToken {
  private readonly endpoint = `${API_BASE_URL}/api/access-token`;

  // Uses a bare axios call (not axiosInstance) since axiosInstance's request
  // interceptor calls this method to mint a token — routing through it here
  // would recurse.
  async createAccessToken(): Promise<ServiceResult<AccessTokenResponse>> {
    try {
      const { data } = await axios.post(
        this.endpoint,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.NEXT_PUBLIC_BACKEND_API_KEY! || "",
          },
        },
      );
      if (!data.success) {
        return {
          success: false,
          message: data.message ?? "Failed to update status",
        };
      }
      return { success: true, data: data.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message ?? "Failed to update status",
      };
    }
  }
}
export const accessToken = new AccessToken();
