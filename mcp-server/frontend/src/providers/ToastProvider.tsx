import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastContextValue {
  message: string | null;
  variant: "info" | "warn" | "error";
  show: (message: string, variant?: "info" | "warn" | "error") => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  message: null,
  variant: "info",
  show: () => {},
  clear: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<"info" | "warn" | "error">("info");

  const show = useCallback((msg: string, v: "info" | "warn" | "error" = "info") => {
    setMessage(msg);
    setVariant(v);
    setTimeout(() => setMessage(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ message, variant, show, clear: () => setMessage(null) }}>
      {children}
      {message && (
        <div
          className={`fixed bottom-4 right-4 z-[100] max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-2 ${
            variant === "error"
              ? "border-red-500/50 bg-red-950/90 text-red-100"
              : variant === "warn"
                ? "border-amber-500/50 bg-amber-950/90 text-amber-100"
                : "border-border bg-card text-foreground"
          }`}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
