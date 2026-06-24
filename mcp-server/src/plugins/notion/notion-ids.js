/**
 * Normalize Notion page/database IDs from URLs, query strings, or raw UUIDs.
 */

const NOTION_ID_ENV_KEYS = new Set([
  "NOTION_ROOT_PAGE_ID",
  "NOTION_PROJECTS_DB_ID",
  "NOTION_TASKS_DB_ID",
  "NOTION_TASK_DATABASE_ID",
  "NOTION_PROJECTS_PAGE_ID",
  "NOTION_PROJECTS_DATA_SOURCE_ID",
  "NOTION_TASKS_DATA_SOURCE_ID",
]);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeNotionId(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";

  s = s.split("?")[0].split("#")[0].trim();

  if (/^https?:\/\//i.test(s) || s.includes("notion.so")) {
    try {
      const url = new URL(s.startsWith("http") ? s : `https://${s}`);
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length) {
        s = segments[segments.length - 1];
      }
    } catch {
      // keep s as-is
    }
  }

  if (s.includes("/")) {
    const segments = s.split("/").filter(Boolean);
    s = segments[segments.length - 1] || s;
  }

  const hex = s.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    return s;
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @param {string} keyName
 * @param {string} value
 */
export function normalizeNotionIdIfApplicable(keyName, value) {
  if (!NOTION_ID_ENV_KEYS.has(keyName) || typeof value !== "string") return value;
  const normalized = normalizeNotionId(value);
  return normalized || value;
}

/**
 * Read env/overlay value and normalize when it is a Notion ID key.
 * @param {(key: string) => string | undefined} getValue
 * @param {string} key
 */
export function getNotionEnvId(getValue, key) {
  const raw = getValue(key);
  if (!raw) return "";
  return NOTION_ID_ENV_KEYS.has(key) ? normalizeNotionId(raw) : raw.trim();
}
