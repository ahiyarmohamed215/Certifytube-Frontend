import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { queryClient } from "./app/queryClient";
import { router } from "./app/routes";
import { getMe } from "./api/auth";
import { useAuthStore } from "./store/useAuthStore";
import "./index.css";

// Restore session on app boot
const token = localStorage.getItem("ct_token");
if (token) {
  getMe()
    .then((user) => useAuthStore.getState().setUser(user))
    .catch(() => useAuthStore.getState().clearAuth());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(16px) saturate(180%)",
            WebkitBackdropFilter: "blur(16px) saturate(180%)",
            color: "#1a1a2e",
            border: "1px solid rgba(0, 0, 0, 0.06)",
            borderRadius: "14px",
            fontSize: "13.5px",
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
            padding: "10px 16px",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
