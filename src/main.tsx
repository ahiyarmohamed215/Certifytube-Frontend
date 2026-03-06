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
            background: "#ffffff",
            color: "#112640",
            border: "1px solid rgba(255, 0, 51, 0.22)",
            borderRadius: "12px",
            fontSize: "14px",
            boxShadow: "0 8px 22px rgba(17, 38, 64, 0.12)",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);

