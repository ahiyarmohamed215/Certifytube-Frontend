import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// --- Request interceptor: inject JWT ---
http.interceptors.request.use((config) => {
  const requestUrl = String(config.url || "");
  const isAuthEntryPoint =
    /\/api\/auth\/login\b/.test(requestUrl) ||
    /\/api\/auth\/signup\b/.test(requestUrl);

  const headers: any = config.headers || {};

  if (isAuthEntryPoint) {
    // Login/signup must not carry stale bearer tokens.
    if (typeof headers.delete === "function") {
      headers.delete("Authorization");
    } else {
      delete headers.Authorization;
    }
    config.headers = headers;
    return config;
  }

  const token = localStorage.getItem("ct_token");
  if (token) {
    if (typeof headers.set === "function") {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
    config.headers = headers;
  }
  return config;
});

// --- Response interceptor: 401 → clear token & redirect ---
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ct_token");
      localStorage.removeItem("ct_user");
      // Redirect only if not already on login/signup
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/signup") {
        window.location.href = "/login";
      }
    }
    let blobMessage = "";
    const blobData = err.response?.data;
    if (blobData instanceof Blob) {
      try {
        const text = await blobData.text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            blobMessage = parsed?.message || parsed?.error || "";
          } catch {
            blobMessage = text;
          }
        }
      } catch {
        // ignore blob parse errors
      }
    }

    const status = err.response?.status;
    const method = String(err.config?.method || "").toUpperCase();
    const requestUrl = String(err.config?.url || "");

    // Extract backend error message
    const msg =
      blobMessage ||
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      "Request failed";

    const hasStructuredMessage = Boolean(
      blobMessage || err.response?.data?.message || err.response?.data?.error
    );

    let finalMsg = msg;
    if (status === 403 && !hasStructuredMessage) {
      const endpoint = method && requestUrl ? `${method} ${requestUrl}` : "request";
      if (/\/api\/auth\/(login|signup)\b/.test(requestUrl)) {
        finalMsg =
          `Forbidden (403) on ${endpoint}. ` +
          "Login/signup was denied by backend (check backend auth/security config and credentials).";
      } else {
        finalMsg =
          `Forbidden (403) on ${endpoint}. ` +
          "You are authenticated, but not allowed for this resource (role/ownership restriction).";
      }
    } else if (status && method && requestUrl && !msg.includes(requestUrl)) {
      finalMsg = `${msg} (${status}) - ${method} ${requestUrl}`;
    }

    return Promise.reject(new Error(finalMsg));
  }
);
