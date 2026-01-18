"use client";

import { Toaster as HotToaster } from "react-hot-toast";

/**
 * Toast Notification Provider
 * Wraps react-hot-toast for consistent notifications
 */
export function ToastProvider() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#000000",
          color: "#ffffff",
          border: "1px solid rgba(193, 255, 114, 0.2)",
        },
        success: {
          iconTheme: {
            primary: "#c1ff72",
            secondary: "#000000",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}
