/**
 * V7 — Jarvis interface modes + live status.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { getHubPauseState } from "./telegram-pause.js";
import { isEmergencyStopActive, getOpsDashboard } from "./personal-ops.service.js";
import { getPersonalAutonomyState, setPersonalAutonomyPreset } from "./personal-autonomy.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.JARVIS_MODE_STORE || join(config.catalog?.cacheDir || "./cache", "jarvis-mode.json");

export const JARVIS_MODES = {
  work: {
    id: "work",
    label: "İş",
    chatProfile: "project_work",
    autonomyPreset: "balanced",
    description: "Proje odaklı çalışma",
  },
  personal: {
    id: "personal",
    label: "Kişisel",
    chatProfile: "personal_assistant",
    autonomyPreset: "balanced",
    description: "Günlük kişisel asistan",
  },
  research: {
    id: "research",
    label: "Araştırma",
    chatProfile: "research",
    autonomyPreset: "cautious",
    description: "Read-only araştırma",
  },
  shopping: {
    id: "shopping",
    label: "Alışveriş",
    chatProfile: "personal_assistant",
    autonomyPreset: "cautious",
    description: "Ürün araştırma modu",
  },
  coding: {
    id: "coding",
    label: "Kod",
    chatProfile: "code_editing",
    autonomyPreset: "helper",
    description: "Kod düzenleme ve shell",
  },
  away: {
    id: "away",
    label: "Uzakta",
    chatProfile: "safe",
    autonomyPreset: "cautious",
    description: "Minimum müdahale",
  },
  focus: {
    id: "focus",
    label: "Odak",
    chatProfile: "answer_only",
    autonomyPreset: "cautious",
    description: "Sadece cevap, tool yok",
  },
};

let memoryMode = null;

function readModeStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) return { modeId: "personal" };
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { modeId: "personal" };
  }
}

function writeModeStore(data) {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function getCurrentJarvisMode() {
  const modeId = memoryMode?.modeId || readModeStore().modeId || "personal";
  const mode = JARVIS_MODES[modeId] || JARVIS_MODES.personal;
  return { ...mode, modeId: mode.id };
}

export function setJarvisMode(modeId) {
  if (!JARVIS_MODES[modeId]) {
    throw Object.assign(new Error(`Unknown mode: ${modeId}`), { code: "invalid" });
  }
  const mode = JARVIS_MODES[modeId];
  memoryMode = { modeId };
  writeModeStore(memoryMode);
  try {
    setPersonalAutonomyPreset(mode.autonomyPreset);
  } catch {
    /* preset optional */
  }
  return getJarvisState();
}

export function listJarvisModes() {
  return Object.values(JARVIS_MODES).map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    chatProfile: m.chatProfile,
    autonomyPreset: m.autonomyPreset,
  }));
}

export function getJarvisQuickActions() {
  const mode = getCurrentJarvisMode();
  const base = [
    { id: "brief", label: "Günlük brifing", action: "briefing.generate", href: "/" },
    { id: "approve-next", label: "Sonraki onay", action: "approval.next", href: "/approvals" },
    { id: "stop", label: "Acil durdur", action: "ops.emergency_stop", href: "/" },
    { id: "runs", label: "Aktif run'lar", action: "runs.list", href: "/runs" },
  ];
  if (mode.id === "shopping") {
    base.unshift({ id: "shop", label: "Ürün ara", action: "shopping.search", href: "/life" });
  }
  if (mode.id === "research") {
    base.unshift({ id: "research", label: "Araştır", action: "chat.research", href: "/chat" });
  }
  return base;
}

export async function getJarvisLiveStatus() {
  const mode = getCurrentJarvisMode();
  const runs = await listRuns({ limit: 15 });
  const active = runs.filter((r) => ["running", "waiting_approval", "paused"].includes(r.status));
  const approvalStore = getApprovalStore();
  const pendingApprovals = approvalStore?.listApprovals?.({ status: "pending" })?.length ?? 0;
  const hubPause = getHubPauseState();
  const ops = getOpsDashboard();
  const autonomy = getPersonalAutonomyState();

  const currentActivity = active[0]
    ? {
        runId: active[0].id,
        goal: active[0].goal,
        status: active[0].status,
        message: active[0].goal || "Agent çalışıyor",
      }
    : pendingApprovals > 0
      ? { runId: null, status: "waiting_approval", message: `${pendingApprovals} onay bekliyor` }
      : { runId: null, status: "idle", message: "Şu an aktif agent yok" };

  return {
    mode,
    currentActivity,
    activeRuns: active.slice(0, 5).map((r) => ({
      id: r.id,
      goal: r.goal,
      status: r.status,
      updatedAt: r.updatedAt,
    })),
    pendingApprovals,
    hubPaused: hubPause.paused,
    emergencyStop: isEmergencyStopActive(),
    autonomy: { presetId: autonomy.presetId, level: autonomy.level },
    quickActions: getJarvisQuickActions(),
    generatedAt: new Date().toISOString(),
  };
}

export function getJarvisState() {
  return {
    mode: getCurrentJarvisMode(),
    modes: listJarvisModes(),
    quickActions: getJarvisQuickActions(),
  };
}

/** Compact payload for desktop overlay companion. */
export async function getJarvisOverlayStatus() {
  const live = await getJarvisLiveStatus();
  return {
    mode: live.mode.label,
    modeId: live.mode.id,
    status: live.currentActivity.status,
    message: live.currentActivity.message,
    pendingApprovals: live.pendingApprovals,
    activeRunCount: live.activeRuns.length,
    hubPaused: live.hubPaused,
    emergencyStop: live.emergencyStop,
    updatedAt: live.generatedAt,
  };
}

/** @internal */
export function resetJarvisModeForTests() {
  memoryMode = null;
}
