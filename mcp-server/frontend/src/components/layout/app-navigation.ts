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
  Home,
  LayoutGrid,
  Settings,
  Shield,
  ShieldCheck,
  Wrench,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const APP_NAV: AppNavItem[] = [
  { to: "/", label: "Panel", icon: Home },
  { to: "/chat", label: "Sohbet", icon: Bot },
  { to: "/runs", label: "Runs", icon: GitBranch },
  { to: "/projects", label: "Projeler", icon: FolderKanban },
  { to: "/approvals", label: "Onaylar", icon: ShieldCheck },
  { to: "/usage", label: "Kullanım", icon: BarChart3 },
  { to: "/eval", label: "Eval", icon: FlaskConical },
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
  "/": "Kontrol Paneli",
  "/chat": "Sohbet",
  "/runs": "Agent Runs",
  "/projects": "Projeler",
  "/approvals": "Onay Merkezi",
  "/usage": "Kullanım",
  "/eval": "Eval Studio",
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
