/**
 * V7 — Personal permission autonomy (risk × level × presets).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { evaluateAutonomyForTool } from "../ops/autonomy.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.PERSONAL_AUTONOMY_STORE || join(config.catalog?.cacheDir || "./cache", "personal-autonomy.json");

export const RISK_CATEGORIES = [
  "read",
  "personal_data",
  "external_send",
  "money",
  "desktop_control",
  "file_write",
  "destructive",
  "production",
  "credential",
];

export const PERSONAL_PRESETS = {
  cautious: {
    id: "cautious",
    label: "Dikkatli",
    level: "L2",
    desktopMode: "observe_only",
    rules: {
      desktop_control: "L3",
      money: "L0",
      destructive: "L0",
      external_send: "L3",
      file_write: "L3",
    },
  },
  balanced: {
    id: "balanced",
    label: "Dengeli",
    level: "L3",
    desktopMode: "assist_with_approval",
    rules: {
      desktop_control: "L3",
      money: "L0",
      destructive: "L2",
      external_send: "L3",
      file_write: "L3",
    },
  },
  helper: {
    id: "helper",
    label: "Yardımcı",
    level: "L4",
    desktopMode: "scoped_automation",
    rules: {
      desktop_control: "L4",
      money: "L0",
      destructive: "L3",
      external_send: "L4",
      file_write: "L4",
    },
  },
};

const TOOL_RISK_MAP = {
  desktop_screenshot: "read",
  desktop_active_window: "read",
  desktop_ocr: "read",
  desktop_click: "desktop_control",
  desktop_type: "desktop_control",
  desktop_scroll: "desktop_control",
  desktop_hotkey: "desktop_control",
  desktop_drag: "desktop_control",
  desktop_focus_app: "desktop_control",
  desktop_app_focus: "desktop_control",
  clipboard_read: "personal_data",
  clipboard_write: "personal_data",
  browser_open: "desktop_control",
  browser_open_url: "read",
  browser_snapshot: "read",
  browser_screenshot: "read",
  browser_extract_links: "read",
  browser_extract_table: "read",
  browser_find_text: "read",
  browser_click: "desktop_control",
  browser_type: "desktop_control",
  browser_click_selector: "desktop_control",
  browser_type_selector: "desktop_control",
  fs_read: "read",
  fs_list: "read",
  fs_write: "file_write",
  terminal_exec: "destructive",
  send_telegram: "external_send",
  send_email: "external_send",
};

/** @type {{ presetId: string, overrides?: Record<string, string> } | null} */
let memoryStore = null;

function ensureFile() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ presetId: "balanced", overrides: {} }, null, 2), "utf8");
  }
}

function readFileStore() {
  ensureFile();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { presetId: "balanced", overrides: {} };
  }
}

function writeStore(data) {
  memoryStore = data;
  try {
    ensureFile();
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch {
    /* optional */
  }
}

export function getPersonalAutonomyConfig() {
  return memoryStore || readFileStore();
}

export function setPersonalAutonomyPreset(presetId) {
  if (!PERSONAL_PRESETS[presetId]) {
    const err = new Error(`Unknown preset: ${presetId}`);
    err.code = "invalid";
    throw err;
  }
  const data = { presetId, overrides: {} };
  writeStore(data);
  return getPersonalAutonomyState();
}

export function getPersonalAutonomyState() {
  const cfg = getPersonalAutonomyConfig();
  const preset = PERSONAL_PRESETS[cfg.presetId] || PERSONAL_PRESETS.balanced;
  return {
    presetId: preset.id,
    label: preset.label,
    level: preset.level,
    desktopMode: preset.desktopMode,
    rules: { ...preset.rules, ...(cfg.overrides || {}) },
    riskCategories: RISK_CATEGORIES,
    presets: Object.values(PERSONAL_PRESETS).map((p) => ({
      id: p.id,
      label: p.label,
      level: p.level,
      desktopMode: p.desktopMode,
    })),
  };
}

export function classifyToolRisk(toolName) {
  const name = String(toolName || "").toLowerCase();
  if (TOOL_RISK_MAP[toolName]) return TOOL_RISK_MAP[toolName];
  if (name.includes("delete") || name.includes("destroy")) return "destructive";
  if (name.includes("payment") || name.includes("checkout")) return "money";
  if (name.startsWith("desktop_")) return "desktop_control";
  if (name.includes("write") || name.includes("upload")) return "file_write";
  if (name.includes("send") || name.includes("notify")) return "external_send";
  return "read";
}

function levelRank(level) {
  const n = parseInt(String(level).replace("L", ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function evaluatePersonalToolPolicy(toolName, context = {}) {
  const state = getPersonalAutonomyState();
  const risk = classifyToolRisk(toolName);
  const requiredLevel = state.rules[risk] || state.level;
  const effectiveLevel = context.autonomyLevel || state.level;

  if (levelRank(effectiveLevel) < levelRank(requiredLevel)) {
    return {
      allowed: false,
      action: "block",
      risk,
      requiredLevel,
      effectiveLevel,
      reasons: [`${risk} requires ${requiredLevel}, personal preset is ${effectiveLevel}`],
    };
  }

  const autonomy = evaluateAutonomyForTool({
    level: effectiveLevel,
    toolName,
    projectEnv: context.projectEnv || "development",
    projectId: context.projectId ?? null,
    estimatedCostUsd: context.estimatedCostUsd ?? 0,
    maxCostUsd: context.maxCostUsd ?? null,
  });

  if (!autonomy.allowed) {
    return {
      allowed: false,
      action: autonomy.action,
      risk,
      requiredLevel,
      effectiveLevel,
      reasons: autonomy.reasons || [],
    };
  }

  return {
    allowed: true,
    action: "allow",
    risk,
    requiredLevel,
    effectiveLevel,
    reasons: [],
  };
}

/** @internal */
export function resetPersonalAutonomyStoreForTests() {
  memoryStore = null;
}
