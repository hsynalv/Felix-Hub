/**
 * V7 — Personal desktop allowlist + mode (in-memory + optional file).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.PERSONAL_DESKTOP_STORE || join(config.catalog?.cacheDir || "./cache", "personal-desktop.json");

export const DESKTOP_MODES = [
  "observe_only",
  "suggest_only",
  "assist_with_approval",
  "scoped_automation",
];

const DEFAULT_ALLOWED_APPS = [
  "Terminal",
  "iTerm2",
  "Cursor",
  "Code",
  "Visual Studio Code",
  "Finder",
  "Google Chrome",
  "Safari",
  "Firefox",
  "Arc",
];

const DEFAULT_ALLOWED_DOMAINS = ["localhost", "127.0.0.1"];

/** @type {{ mode: string, allowedApps: string[], allowedDomains: string[], updatedAt?: string } | null} */
let memoryStore = null;

function ensureFile() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(
      STORE_PATH,
      JSON.stringify(
        {
          mode: "assist_with_approval",
          allowedApps: DEFAULT_ALLOWED_APPS,
          allowedDomains: DEFAULT_ALLOWED_DOMAINS,
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readFileStore() {
  ensureFile();
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function defaultStore() {
  return {
    mode: "assist_with_approval",
    allowedApps: [...DEFAULT_ALLOWED_APPS],
    allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
    updatedAt: new Date().toISOString(),
  };
}

export function getPersonalDesktopConfig() {
  if (memoryStore) return { ...memoryStore };
  const file = readFileStore();
  if (file) return { ...defaultStore(), ...file };
  return defaultStore();
}

export function updatePersonalDesktopConfig(patch = {}) {
  const current = getPersonalDesktopConfig();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (patch.mode && !DESKTOP_MODES.includes(patch.mode)) {
    const err = new Error(`Invalid desktop mode: ${patch.mode}`);
    err.code = "invalid";
    throw err;
  }
  if (patch.allowedApps) next.allowedApps = patch.allowedApps.map(String);
  if (patch.allowedDomains) next.allowedDomains = patch.allowedDomains.map(String);
  memoryStore = next;
  try {
    ensureFile();
    writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    /* file optional in tests */
  }
  return next;
}

/** @internal */
export function resetPersonalDesktopStoreForTests() {
  memoryStore = null;
}
