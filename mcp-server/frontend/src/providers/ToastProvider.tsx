import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warn" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  message: string | null;
  variant: ToastVariant;
  show: (message: string, variant?: ToastVariant) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  message: null,
  variant: "info",
  show: () => {},
  clear: () => {},
});

const TOAST_MS = 5200;

const VARIANT_STYLES: Record<
  ToastVariant,
  { ring: string; bg: string; icon: typeof Info; iconClass: string; bar: string }
> = {
  info: {
    ring: "ring-sky-500/30",
    bg: "from-sky-500/15 via-card to-card border-sky-500/25",
    icon: Info,
    iconClass: "text-sky-400",
    bar: "bg-sky-400",
  },
  success: {
    ring: "ring-emerald-500/30",
    bg: "from-emerald-500/15 via-card to-card border-emerald-500/25",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    bar: "bg-emerald-400",
  },
  warn: {
    ring: "ring-amber-500/35",
    bg: "from-amber-500/15 via-card to-card border-amber-500/30",
    icon: AlertTriangle,
    iconClass: "text-amber-400",
    bar: "bg-amber-400",
  },
  error: {
    ring: "ring-red-500/35",
    bg: "from-red-500/15 via-card to-card border-red-500/30",
    icon: XCircle,
    iconClass: "text-red-400",
    bar: "bg-red-400",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (msg: string, variant: ToastVariant = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, message: msg, variant }]);
      const timer = setTimeout(() => dismiss(id), TOAST_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const top = toasts[toasts.length - 1] ?? null;

  return (
    <ToastContext.Provider
      value={{
        message: top?.message ?? null,
        variant: top?.variant ?? "info",
        show,
        clear: () => top && dismiss(top.id),
      }}
    >
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const style = VARIANT_STYLES[toast.variant];
            const Icon = style.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: "spring", damping: 22, stiffness: 380 }}
                className={cn(
                  "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border bg-gradient-to-br shadow-2xl shadow-black/25 ring-1 backdrop-blur-xl",
                  style.bg,
                  style.ring
                )}
              >
                <div className="flex items-start gap-3 p-4 pr-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/60",
                      style.iconClass
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-snug text-foreground">
                    {toast.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <motion.div
                  className={cn("h-1 origin-left", style.bar)}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: TOAST_MS / 1000, ease: "linear" }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
