import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONVERSATION_SETTINGS,
  INSTRUCTION_PRESETS,
  MAX_INSTRUCTIONS_LENGTH,
  type ConversationSettings,
  hasActiveInstructions,
} from "@/lib/chat-instructions";

type ChatInstructionsSheetProps = {
  settings: ConversationSettings;
  persistenceEnabled?: boolean;
  onSave: (settings: ConversationSettings) => Promise<void> | void;
  disabled?: boolean;
};

export function ChatInstructionsSheet({
  settings,
  persistenceEnabled = true,
  onSave,
  disabled,
}: ChatInstructionsSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ConversationSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const active = hasActiveInstructions(settings);

  const handlePreset = (presetId: string) => {
    const preset = INSTRUCTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft((d) => ({
      ...d,
      presetId,
      instructions: preset.instructions,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        instructions: (draft.instructions || "").slice(0, MAX_INSTRUCTIONS_LENGTH),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setDraft({ ...DEFAULT_CONVERSATION_SETTINGS });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative shrink-0 gap-1.5 rounded-xl"
          disabled={disabled}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Talimatlar</span>
          {active && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Sohbet talimatları</SheetTitle>
          <SheetDescription>
            Bu sohbete özel davranış kuralları. Her yeni mesajda modele iletilir.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
          {!persistenceEnabled && (
            <Alert variant="warning">
              <AlertDescription>
                Kalıcı depolama kapalı — talimatlar yalnızca bu oturumda geçerli.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Şablon</Label>
            <Select value={draft.presetId || "general"} onValueChange={handlePreset}>
              <SelectTrigger>
                <SelectValue placeholder="Şablon seç" />
              </SelectTrigger>
              <SelectContent>
                {INSTRUCTION_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-instructions">Özel talimatlar</Label>
              <span className="text-[10px] text-muted-foreground">
                {(draft.instructions || "").length}/{MAX_INSTRUCTIONS_LENGTH}
              </span>
            </div>
            <Textarea
              id="chat-instructions"
              value={draft.instructions || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  instructions: e.target.value.slice(0, MAX_INSTRUCTIONS_LENGTH),
                }))
              }
              rows={8}
              placeholder="Örn: Her zaman Türkçe yanıt ver. Kod örneklerinde TypeScript kullan."
              className="resize-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <Label htmlFor="brain-context">Brain bağlamı</Label>
              <p className="text-xs text-muted-foreground">Hafıza ve proje bağlamını dahil et</p>
            </div>
            <Switch
              id="brain-context"
              checked={draft.includeBrainContext !== false}
              onCheckedChange={(checked) =>
                setDraft((d) => ({ ...d, includeBrainContext: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Yanıt stili</Label>
            <div className="flex gap-2">
              {(["concise", "detailed"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, responseStyle: style }))}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm transition-colors",
                    draft.responseStyle === style
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {style === "concise" ? "Kısa" : "Detaylı"}
                </button>
              ))}
            </div>
          </div>

          {active && (
            <Badge variant="default" className="w-fit">
              Aktif talimatlar kayıtlı
            </Badge>
          )}
        </div>

        <div className="flex flex-row gap-2 border-t border-border/60 pt-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleClear} disabled={saving}>
            Temizle
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
