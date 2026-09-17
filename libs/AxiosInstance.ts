import axios from "axios";
import { API_BASE_URL } from "@/constants";
import { store } from "@/store/storeConfig";
import {
  setAccessToken,
  clearAccessToken,
} from "@/store/slices/AccessToken/access-token.slice";
import { accessToken as accessTokenApi } from "@/app/feature/access-token/api/short-live-token.api";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Dedupes concurrent requests so a burst of calls on mount doesn't mint
// multiple access tokens at once.
let pendingTokenRequest: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  const { accessToken, expiresAt } = store.getState().accessToken;

  if (accessToken && expiresAt && new Date(expiresAt) > new Date()) {
    return accessToken;
  }
  if (accessToken) {
    store.dispatch(clearAccessToken());
  }
  if (!pendingTokenRequest) {
    pendingTokenRequest = accessTokenApi
      .createAccessToken()
      .then((result) => {
        if (!result.success || !result.data) return null;
        store.dispatch(setAccessToken(result.data));
        return result.data.accessToken;
      })
      .finally(() => {
        pendingTokenRequest = null;
      });
  }
  return pendingTokenRequest;
}

axiosInstance.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;
