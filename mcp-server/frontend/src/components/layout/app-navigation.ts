import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
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
  User,
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

export type AppNavGroup = {
  id: string;
  label: string;
  items: AppNavItem[];
};

/** Routes that require admin scope (hidden from nav when user is not admin). */
export const ADMIN_ONLY_NAV_PATHS = new Set(["/admin", "/intent-training"]);

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    id: "daily",
    label: "Günlük",
    items: [
      { to: "/today", label: "Bugün", icon: Home },
      { to: "/guide", label: "Rehber", icon: BookOpen },
      { to: "/life", label: "Life", icon: Flower2 },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/approvals", label: "Onaylar", icon: ShieldCheck },
    ],
  },
  {
    id: "agents",
    label: "Agent",
    items: [
      { to: "/chat", label: "Sohbet", icon: Bot },
      { to: "/runs", label: "Runs", icon: GitBranch },
      { to: "/workflows/designer", label: "Workflow", icon: Wand2 },
      { to: "/projects", label: "Projeler", icon: FolderKanban },
      { to: "/brain", label: "Brain", icon: Brain },
      { to: "/v6", label: "Ekosistem", icon: Sparkles },
    ],
  },
  {
    id: "ops",
    label: "Operasyon",
    items: [
      { to: "/usage", label: "Kullanım", icon: BarChart3 },
      { to: "/eval", label: "Eval", icon: FlaskConical },
      { to: "/ops", label: "Runbooks", icon: Timer },
      { to: "/tools", label: "Araçlar", icon: Wrench },
      { to: "/plugins", label: "Plugins", icon: LayoutGrid },
      { to: "/audit", label: "Audit", icon: Shield },
      { to: "/admin", label: "Admin", icon: ShieldCheck },
      { to: "/observability", label: "Observability", icon: Activity },
      { to: "/intent-training", label: "Intent Eğitimi", icon: BrainCircuit },
    ],
  },
];

/** Flat list for route titles and legacy use */
export const APP_NAV: AppNavItem[] = [
  ...APP_NAV_GROUPS.flatMap((g) => g.items),
  { to: "/settings", label: "Ayarlar", icon: Settings },
  { to: "/settings?tab=account", label: "Hesabım", icon: User },
];

export const APP_ROUTE_TITLES: Record<string, string> = {
  "/today": "Bugün",
  "/guide": "Rehber",
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
