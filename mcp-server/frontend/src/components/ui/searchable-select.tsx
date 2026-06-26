import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Ara veya seç…",
  disabled,
  loading,
  emptyMessage = "Sonuç bulunamadı",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.value.toLowerCase().includes(q) ||
            o.label.toLowerCase().includes(q) ||
            o.description?.toLowerCase().includes(q) ||
            o.meta?.toLowerCase().includes(q)
        )
      : options;
    return list.slice(0, 120);
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (selected) {
      setQuery(selected.label);
    } else {
      setQuery("");
    }
  }, [open, selected?.label]);

  const openDropdown = () => {
    if (disabled || loading) return;
    setOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          disabled={disabled || loading}
          value={open ? query : selected?.label || value || ""}
          placeholder={placeholder}
          className="pr-9 pl-9"
          onFocus={openDropdown}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && filtered[0]) {
              onValueChange(filtered[0].value);
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={() => (open ? setOpen(false) : openDropdown())}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {loading && <Skeleton className="mt-2 h-8 w-full" />}

      {open && !loading && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border/60 bg-card shadow-lg">
          <ScrollArea className="max-h-64">
            <ul className="p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</li>
              ) : (
                filtered.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                          active && "bg-primary/10"
                        )}
                        onClick={() => {
                          onValueChange(opt.value);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            {opt.label}
                            {opt.meta && (
                              <span className="font-sans text-[10px] text-muted-foreground">({opt.meta})</span>
                            )}
                          </span>
                          {opt.description && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                              {opt.description}
                            </span>
                          )}
                        </span>
                        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
