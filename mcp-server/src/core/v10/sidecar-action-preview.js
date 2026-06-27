/**
 * V10 — Sidecar action preview + risk scoring.
 */

import { fsAccessPreview } from "../../plugins/local-sidecar/fs-path-policy.js";
import { classifyBrowserUrl } from "../../plugins/local-sidecar/browser-guard.js";
import { isSidecarPowerCommand } from "../../plugins/local-sidecar/sidecar-terminal-config.js";

const FS_TOOLS = new Set([
  "fs_list",
  "fs_read",
  "fs_write",
  "fs_hash",
  "fs_stat",
  "fs_recent",
  "fs_search",
  "fs_copy",
  "fs_move",
  "fs_delete_to_trash",
]);
const FS_WRITE_TOOLS = new Set(["fs_write", "fs_copy", "fs_move", "fs_delete_to_trash"]);
const TERMINAL_TOOLS = new Set([
  "local_terminal_exec",
  "local_terminal_session_exec",
  "local_terminal_session_create",
]);
const DESKTOP_ACTION_TOOLS = new Set([
  "desktop_click",
  "desktop_type",
  "desktop_scroll",
  "desktop_hotkey",
  "desktop_drag",
]);
const CLIPBOARD_TOOLS = new Set(["clipboard_read", "clipboard_write"]);
const SCREENSHOT_TOOLS = new Set([
  "desktop_screenshot",
  "desktop_region_screenshot",
  "desktop_window_screenshot",
  "browser_screenshot",
]);
const BROWSER_TOOLS = new Set([
  "browser_open_url",
  "browser_snapshot",
  "browser_screenshot",
  "browser_extract_links",
  "browser_extract_table",
  "browser_find_text",
  "browser_click",
  "browser_type",
]);
const BROWSER_ACTION_TOOLS = new Set(["browser_click", "browser_type"]);

/**
 * @param {string} toolName
 * @param {object} args
 * @param {object} [context]
 */
export function sidecarRiskScore(toolName, args = {}, context = {}) {
  if (FS_WRITE_TOOLS.has(toolName)) {
    const path = args.path || args.source || args.destination || ".";
    const preview = fsAccessPreview(path, "write");
    return {
      risk: "high",
      score: 75,
      preview: { ...preview, operation: toolName },
    };
  }

  if (FS_TOOLS.has(toolName)) {
    const path = args.path || args.dir || ".";
    const op =
      toolName === "fs_list" || toolName === "fs_search" || toolName === "fs_recent"
        ? "list"
        : toolName === "fs_write"
          ? "write"
          : "read";
    const preview = fsAccessPreview(path, op);
    if (preview.blocked) return { risk: "critical", score: 100, preview };
    if (preview.requireApproval) {
      return {
        risk: preview.classification === "critical" ? "critical" : "medium",
        score: preview.classification === "critical" ? 90 : 55,
        preview,
      };
    }
    return { risk: "low", score: 10, preview };
  }

  if (TERMINAL_TOOLS.has(toolName)) {
    const cmd = args.command || "";
    if (isSidecarPowerCommand(cmd)) {
      return { risk: "critical", score: 85, preview: { command: cmd, power: true } };
    }
    return { risk: "medium", score: 40, preview: { command: cmd } };
  }

  if (DESKTOP_ACTION_TOOLS.has(toolName)) {
    return { risk: "high", score: 70, preview: { toolName, args } };
  }

  if (CLIPBOARD_TOOLS.has(toolName)) {
    return {
      risk: toolName === "clipboard_write" ? "high" : "medium",
      score: toolName === "clipboard_write" ? 65 : 50,
      preview: { toolName },
    };
  }

  if (BROWSER_ACTION_TOOLS.has(toolName)) {
    return { risk: "high", score: 75, preview: { toolName, selector: args.selector } };
  }

  if (BROWSER_TOOLS.has(toolName)) {
    const urlClass = args.url ? classifyBrowserUrl(args.url) : { classification: "normal" };
    if (urlClass.classification === "sensitive") {
      return { risk: "critical", score: 85, preview: { url: args.url, ...urlClass } };
    }
    return { risk: "low", score: 20, preview: { toolName, url: args.url } };
  }

  if (SCREENSHOT_TOOLS.has(toolName)) {
    return { risk: "low", score: 15, preview: { toolName } };
  }

  if (toolName.startsWith("desktop_")) {
    return { risk: "low", score: 15, preview: { toolName } };
  }

  return { risk: "low", score: 5, preview: null };
}

/**
 * @param {string} toolName
 * @param {object} args
 * @param {object} [context]
 */
export function buildSidecarActionPreview(toolName, args = {}, context = {}) {
  const scored = sidecarRiskScore(toolName, args, context);
  const channel = context.channel || context.source || "hub";

  let target = { type: "sidecar", toolName };
  let summary = toolName;
  const details = { ...(scored.preview || {}) };

  if (FS_TOOLS.has(toolName)) {
    const path = args.path || args.source || args.dir || ".";
    const op = fsOperationFromTool(toolName, args);
    const access = fsAccessPreview(path, op);
    target = {
      type: "filesystem",
      path,
      resolvedPath: access.resolvedPath,
      classification: access.classification,
      operation: op,
    };
    if (args.destination) {
      target.destination = args.destination;
      details.destinationPreview = fsAccessPreview(args.destination, "write");
    }
    summary = `${op} ${path}${args.destination ? ` → ${args.destination}` : ""}`;
    details.reason = access.reason;
  }

  if (TERMINAL_TOOLS.has(toolName) && args.command) {
    target = { type: "terminal", command: args.command };
    summary = `Run: ${String(args.command).slice(0, 120)}`;
  }

  if (DESKTOP_ACTION_TOOLS.has(toolName)) {
    target = { type: "desktop_action", toolName };
    summary =
      toolName === "desktop_hotkey"
        ? `Hotkey: ${JSON.stringify(args.keys)}`
        : toolName === "desktop_scroll"
          ? `Scroll ${args.direction || "down"}`
          : toolName === "desktop_drag"
            ? `Drag (${args.fromX},${args.fromY}) → (${args.toX},${args.toY})`
            : `${toolName} on desktop`;
  }

  if (CLIPBOARD_TOOLS.has(toolName)) {
    target = { type: "clipboard", toolName };
    summary = toolName === "clipboard_write" ? "Write clipboard" : "Read clipboard";
  }

  if (BROWSER_TOOLS.has(toolName)) {
    target = { type: "browser", toolName, url: args.url || null };
    summary =
      toolName === "browser_open_url"
        ? `Open ${args.url}`
        : toolName === "browser_click"
          ? `Click ${args.selector}`
          : toolName === "browser_type"
            ? `Type into ${args.selector}`
            : toolName;
  }

  if (SCREENSHOT_TOOLS.has(toolName)) {
    target = { type: "screenshot", toolName };
    summary =
      toolName === "desktop_region_screenshot"
        ? `Screenshot region ${args.x},${args.y} ${args.width}x${args.height}`
        : toolName === "desktop_window_screenshot"
          ? "Screenshot active window"
          : "Full screen screenshot";
  }

  return {
    id: `preview_${toolName}_${Date.now()}`,
    toolName,
    channel,
    risk: scored.risk,
    requiresApproval:
      FS_WRITE_TOOLS.has(toolName) ||
      scored.risk === "critical" ||
      scored.risk === "high" ||
      scored.score >= 55,
    target,
    summary,
    details,
    artifacts: {
      screenshotBase64: null,
      diff: null,
      filePreview: null,
    },
    undo: {
      available:
        toolName === "fs_write" ||
        toolName === "fs_move" ||
        toolName === "fs_delete_to_trash" ||
        toolName === "clipboard_write",
      description:
        toolName === "fs_write"
          ? "Previous file content saved in undo record"
          : toolName === "fs_move"
            ? "Reverse move available via undo"
            : toolName === "fs_delete_to_trash"
              ? "Restore from Trash via undo"
              : toolName === "clipboard_write"
                ? "Previous clipboard saved in undo"
                : null,
    },
    score: scored.score,
  };
}

/**
 * Extract filesystem path from fs_* tool args.
 * @param {string} toolName
 * @param {object} args
 */
export function fsPathFromToolArgs(toolName, args = {}) {
  if (!FS_TOOLS.has(toolName)) return null;
  if (toolName === "fs_copy" || toolName === "fs_move") return args.source ?? args.path ?? ".";
  return args.path ?? args.dir ?? ".";
}

/**
 * @param {string} toolName
 * @param {object} args
 */
export function fsOperationFromTool(toolName, args = {}) {
  if (toolName === "fs_list" || toolName === "fs_search" || toolName === "fs_recent") return "list";
  if (toolName === "fs_write" || toolName === "fs_delete_to_trash") return "write";
  if (toolName === "fs_copy") return "read";
  if (toolName === "fs_move") return "write";
  if (toolName === "fs_hash") return "hash";
  if (toolName === "fs_stat") return "read";
  if (toolName === "fs_read") return "read";
  return "read";
}
