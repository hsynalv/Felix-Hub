import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  BrainCircuit,
  FlaskConical,
  FolderKanban,
  GitBranch,
  Inbox,
  Home,
  LayoutGrid,
  Settings,
  Shield,
  ShieldCheck,
  Timer,
  Wand2,
  Wrench,
  Sparkles,
  Flower2,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const APP_NAV: AppNavItem[] = [
  { to: "/", label: "Bugün", icon: Home },
  { to: "/life", label: "Life", icon: Flower2 },
  { to: "/chat", label: "Sohbet", icon: Bot },
  { to: "/runs", label: "Runs", icon: GitBranch },
  { to: "/workflows/designer", label: "Workflow", icon: Wand2 },
  { to: "/projects", label: "Projeler", icon: FolderKanban },
  { to: "/approvals", label: "Onaylar", icon: ShieldCheck },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/usage", label: "Kullanım", icon: BarChart3 },
  { to: "/eval", label: "Eval", icon: FlaskConical },
  { to: "/ops", label: "Ops", icon: Timer },
  { to: "/v6", label: "Ekosistem", icon: Sparkles },
  { to: "/brain", label: "Brain", icon: Brain },
  { to: "/tools", label: "Araçlar", icon: Wrench },
  { to: "/plugins", label: "Plugins", icon: LayoutGrid },
  { to: "/audit", label: "Audit", icon: Shield },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/observability", label: "Observability", icon: Activity },
  { to: "/intent-training", label: "Intent Eğitimi", icon: BrainCircuit },
  { to: "/settings", label: "Ayarlar", icon: Settings },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  "/": "Bugün",
  "/life": "Life Agents",
  "/system": "Sistem Paneli",
  "/chat": "Sohbet",
  "/runs": "Agent Runs",
  "/workflows/designer": "Workflow Designer",
  "/projects": "Projeler",
  "/approvals": "Onay Merkezi",
  "/inbox": "Agent Inbox",
  "/usage": "Kullanım",
  "/eval": "Eval Studio",
  "/ops": "Runbooks & Schedules",
  "/v6": "Agent Ekosistemi",
  "/brain": "Brain",
  "/tools": "Araçlar",
  "/plugins": "Plugins",
  "/audit": "Audit",
  "/admin": "Admin",
  "/observability": "Observability",
  "/intent-training": "Intent Eğitimi",
  "/settings": "Ayarlar",
};

/** Pages that render their own top chrome but still need the global nav menu. */
export const IMMERSIVE_APP_PATHS = new Set(["/chat", "/brain"]);
