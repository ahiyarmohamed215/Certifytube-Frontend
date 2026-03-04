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
            background: "#1a2236",
            color: "#f1f5f9",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
