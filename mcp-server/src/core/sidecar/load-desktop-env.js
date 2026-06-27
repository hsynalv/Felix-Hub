/**
 * Load Felix Desktop env file into process.env (only unset keys).
 * Default: ~/.config/felix-desktop/env
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * @param {string} [configDir]
 */
export function loadFelixDesktopEnv(configDir) {
  const dir = configDir || process.env.FELIX_DESKTOP_CONFIG || join(homedir(), ".config", "felix-desktop");
  const envPath = join(dir, "env");
  if (!existsSync(envPath)) return { loaded: false, path: envPath };

  const text = readFileSync(envPath, "utf8");
  let count = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
      count += 1;
    }
  }
  return { loaded: true, path: envPath, keys: count };
}
