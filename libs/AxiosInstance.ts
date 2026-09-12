import axios from "axios";
import { API_BASE_URL } from "@/constants";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.NEXT_PUBLIC_BACKEND_API_KEY! || "",
  },
});

export default axiosInstance;
