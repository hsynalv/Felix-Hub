export const INTENT_COLORS: Record<string, string> = {
  no_tool: "bg-muted text-muted-foreground",
  brain_save: "bg-violet-500/15 text-violet-600",
  brain_recall: "bg-purple-500/15 text-purple-600",
  project_context: "bg-blue-500/15 text-blue-600",
  read_repo: "bg-cyan-500/15 text-cyan-600",
  modify_files: "bg-amber-500/15 text-amber-600",
  run_command: "bg-orange-500/15 text-orange-600",
  external_api: "bg-emerald-500/15 text-emerald-600",
  automation: "bg-pink-500/15 text-pink-600",
  general: "bg-slate-500/15 text-slate-600",
};

export function intentBadgeClass(intent: string) {
  return INTENT_COLORS[intent] || INTENT_COLORS.general;
}
