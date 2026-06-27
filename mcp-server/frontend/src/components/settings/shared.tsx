import { useCallback, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff, Loader2, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchSettingReveal } from "@/lib/settings-api";
import { ApiError } from "@/lib/api-client";

/** Password input with always-visible eye toggle (local value only). */
export function SecretInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
        autoComplete="off"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full w-9 shrink-0"
        aria-label={show ? "Gizle" : "Göster"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

/**
 * Stored setting value — eye always visible; reveals plaintext from API (not masked placeholder).
 */
export function SettingSecretField({
  settingKey,
  configured,
  maskedValue,
  onSave,
  saving,
  placeholder = "Ayarlanmadı",
}: {
  settingKey: string;
  configured: boolean;
  maskedValue: string | null;
  onSave: (value: string) => void;
  saving?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [showRevealed, setShowRevealed] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const resetReveal = useCallback(() => {
    setRevealed(null);
    setShowRevealed(false);
    setRevealError(null);
  }, []);

  const startEdit = () => {
    resetReveal();
    setDraft("");
    setShowDraft(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
    setShowDraft(false);
  };

  const saveEdit = () => {
    if (!draft.trim()) return;
    onSave(draft.trim());
    setEditing(false);
    setDraft("");
    setShowDraft(false);
    resetReveal();
  };

  const toggleReveal = async () => {
    if (showRevealed) {
      setShowRevealed(false);
      return;
    }
    if (revealed != null) {
      setShowRevealed(true);
      return;
    }
    if (!configured) return;
    setRevealLoading(true);
    setRevealError(null);
    try {
      const data = await fetchSettingReveal(settingKey);
      setRevealed(data.value);
      setShowRevealed(true);
    } catch (e) {
      setRevealError(e instanceof ApiError ? e.message : "Değer okunamadı");
    } finally {
      setRevealLoading(false);
    }
  };

  if (editing) {
    return (
      <div className="flex min-w-[200px] items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Input
            type={showDraft ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={configured ? "Yeni değer gir…" : "Değer gir…"}
            className="h-8 pr-9 font-mono text-xs"
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0"
            aria-label={showDraft ? "Gizle" : "Göster"}
            onClick={() => setShowDraft((s) => !s)}
          >
            {showDraft ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!draft.trim() || saving}
          onClick={saveEdit}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={cancelEdit}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const displayValue = showRevealed && revealed != null ? revealed : configured ? maskedValue || "••••••••" : "";

  return (
    <div className="min-w-[200px] space-y-1">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Input
            readOnly
            type={showRevealed ? "text" : "password"}
            value={displayValue}
            placeholder={placeholder}
            className={cn(
              "h-8 pr-9 font-mono text-xs",
              !configured && "text-muted-foreground italic"
            )}
            onFocus={(e) => e.target.blur()}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 shrink-0"
            disabled={!configured || revealLoading}
            aria-label={showRevealed ? "Gizle" : "Gerçek değeri göster"}
            onClick={() => void toggleReveal()}
          >
            {revealLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : showRevealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Düzenle"
          onClick={startEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
      {revealError && <p className="text-[10px] text-destructive">{revealError}</p>}
    </div>
  );
}

export function SettingsInfoBox({
  title,
  children,
  variant = "default",
}: {
  title?: string;
  children: ReactNode;
  variant?: "default" | "warning" | "tip";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        variant === "default" && "border-border bg-muted/30 text-muted-foreground",
        variant === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-100",
        variant === "tip" && "border-primary/30 bg-primary/5 text-foreground"
      )}
    >
      {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
      {children}
    </div>
  );
}

export function SettingsSectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  accent,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        accent && "border-primary/20 shadow-sm shadow-primary/5",
        className
      )}
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function SettingsStepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}
