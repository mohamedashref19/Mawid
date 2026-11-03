import axios from "axios";

// رابط الباك إند الأساسي (تقدر تغيره من ملف .env في الفرونت إند)
// export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";
export const BACKEND_URL = "http://127.0.0.1:5000";
// رابط الـ API
const baseURL = `${BACKEND_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    // جلب التوكن من الـ localStorage
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default apiClient;
