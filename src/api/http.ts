import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// --- Request interceptor: inject JWT ---
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("ct_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: 401 → clear token & redirect ---
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ct_token");
      localStorage.removeItem("ct_user");
      // Redirect only if not already on login/signup
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/signup") {
        window.location.href = "/login";
      }
    }
    // Extract backend error message
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);
