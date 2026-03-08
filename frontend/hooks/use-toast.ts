// Simple toast hook for notifications
// This is a minimal implementation - consider using sonner or react-hot-toast for production

import { useState, useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

let toastListener: ((toast: Toast) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListener = (toast: Toast) => {
      // For now, just use console and alert
      // In a real implementation, this would show a toast UI component
      console.log("Toast:", toast);

      // Use browser alert for now (will replace with proper toast UI later)
      if (toast.variant === "destructive") {
        alert(`Error: ${toast.title}\n${toast.description || ""}`);
      } else {
        alert(`${toast.title}\n${toast.description || ""}`);
      }
    };

    return () => {
      toastListener = null;
    };
  }, []);

  const toast = (options: Toast) => {
    if (toastListener) {
      toastListener(options);
    }
  };

  return { toast, toasts };
}
