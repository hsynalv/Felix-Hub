import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquarePlus, MoreHorizontal, Pencil, MessagesSquare, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatTime } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  listConversations,
  updateConversation,
  type ConversationProjectScope,
  type ConversationSummary,
} from "@/lib/conversations-api";
import { ApiError } from "@/lib/api-client";
import { conversationIdsMatch } from "@/lib/conversation-ids";
import { getProjectId } from "@/lib/project-context";
import { subscribeWorkspaceContext } from "@/lib/workspace-context-store";
import { useToast } from "@/providers/ToastProvider";
import { Badge } from "@/components/ui/badge";

type ChatSidebarProps = {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  persistenceEnabled?: boolean;
  className?: string;
};

const SCOPE_OPTIONS: { id: ConversationProjectScope; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "current", label: "Bu proje" },
  { id: "unassigned", label: "Projesiz" },
];

export function ChatSidebar({ activeId, onSelect, persistenceEnabled, className }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<ConversationProjectScope>("all");
  const [workspaceProjectId, setWorkspaceProjectId] = useState(() => getProjectId());
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    return subscribeWorkspaceContext(() => setWorkspaceProjectId(getProjectId()));
  }, []);

  const { data: conversations = [], isLoading, isError, error } = useQuery({
    queryKey: ["conversations", scope],
    queryFn: () => listConversations(50, scope),
    enabled: persistenceEnabled !== false,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: { title: string; projectId?: string | null } = { title: "Yeni sohbet" };
      if (scope === "unassigned") payload.projectId = null;
      else if (scope === "current") payload.projectId = workspaceProjectId;
      return createConversation(payload);
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onSelect(conv.id);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Sohbet oluşturulamadı", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (activeId && conversationIdsMatch(activeId, id)) onSelect(null);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Silinemedi", "error"),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => updateConversation(id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setRenameTarget(null);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Yeniden adlandırılamadı", "error"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  if (persistenceEnabled === false) {
    return (
      <aside
        className={cn(
          "flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-sidebar/95 backdrop-blur-sm",
          className
        )}
      >
        <div className="p-4 text-xs leading-relaxed text-muted-foreground">
          Sohbet geçmişi için kalıcı depolama gerekir. Ayarlardan etkinleştirebilirsin.
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-sidebar/95 text-sidebar-foreground backdrop-blur-sm",
        className
      )}
    >
      <div className="shrink-0 space-y-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Sohbetler</p>
            <p className="text-[10px] text-muted-foreground">{conversations.length} kayıt</p>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            className="w-full justify-start gap-2 rounded-xl shadow-sm"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Yeni sohbet
          </Button>
        </motion.div>

        <div className="flex flex-wrap gap-1">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                scope === opt.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sohbet ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl border-border/60 bg-background/50 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="space-y-1 p-2">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="mb-1 h-14 w-full rounded-xl" />
            ))}
          {isError && (
            <p className="px-2 py-4 text-xs text-destructive">
              {error instanceof ApiError ? error.message : "Sohbetler yüklenemedi"}
            </p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="px-2 py-10 text-center text-xs text-muted-foreground">Henüz sohbet yok</p>
          )}

          <AnimatePresence initial={false}>
            {filtered.map((conv, i) => {
              const active = conversationIdsMatch(activeId, conv.id);
              return (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: Math.min(i * 0.02, 0.15) }}
                  className={cn(
                    "group relative flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition-colors",
                    active ? "bg-primary/12" : "hover:bg-muted/50"
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                    />
                  )}
                  <button type="button" className="min-w-0 flex-1 py-0.5 pl-2 text-left" onClick={() => onSelect(conv.id)}>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("truncate font-medium", active && "text-primary")}>{conv.title}</span>
                      {scope === "all" && !conv.projectId && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px]">
                          projesiz
                        </Badge>
                      )}
                      {scope === "all" && conv.projectId && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 font-mono text-[9px]">
                          {conv.projectId}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {conv.messageCount} mesaj · {formatTime(conv.updatedAt)}
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(conv);
                          setRenameValue(conv.title);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Yeniden adlandır
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(conv.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sohbeti yeniden adlandır</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              İptal
            </Button>
            <Button
              disabled={!renameValue.trim() || renameMutation.isPending}
              onClick={() => renameTarget && renameMutation.mutate({ id: renameTarget.id, title: renameValue.trim() })}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
