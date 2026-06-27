/**
 * Normalize large tool results for LLM context (no LLM call).
 */

import {
  extractImagePayloadFromToolResult,
  isScreenshotToolName,
} from "./tool-result-media.js";

const DEFAULT_MAX = 2_000;

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  const head = Math.floor(max * 0.7);
  const tail = max - head - 20;
  return `${str.slice(0, head)}\n…[truncated ${str.length - max} chars]…\n${str.slice(-tail)}`;
}

function summarizeArray(arr, maxItems = 10) {
  if (!Array.isArray(arr)) return null;
  const slice = arr.slice(0, maxItems);
  return {
    count: arr.length,
    shown: slice.length,
    items: slice,
    truncated: arr.length > maxItems,
  };
}

/**
 * @param {{ toolName: string; result: object; maxChars?: number; runId?: string }} opts
 */
export function summarizeToolResult({ toolName, result, maxChars = DEFAULT_MAX, runId }) {
  if (result?.ok === false || result?.error) {
    const err = result.error || {};
    const statusPart = err.status ? ` (HTTP ${err.status})` : "";
    const msg = err.message || (err.status ? `HTTP ${err.status}` : "unknown");
    return {
      ok: false,
      summary: `Tool ${toolName} failed: ${err.code || "error"} — ${msg}${statusPart && !msg.includes(String(err.status)) ? statusPart : ""}`,
      keyFacts: [err.code, err.message].filter(Boolean),
      rawRef: runId ? { runId, toolName } : undefined,
      truncated: false,
    };
  }

  const payload = result?.data !== undefined ? result : { ok: result?.ok !== false, data: result };

  if (payload.ok === false || payload.error) {
    const err = payload.error || {};
    return {
      ok: false,
      summary: `Tool ${toolName} failed: ${err.code || "error"} — ${err.message || "unknown"}`,
      keyFacts: [err.code, err.message].filter(Boolean),
      rawRef: runId ? { runId, toolName } : undefined,
      truncated: false,
    };
  }

  const data = payload.data ?? payload;
  const keyFacts = [];

  if (isScreenshotToolName(toolName)) {
    if (data.deliveryBlocked || data.sensitiveContext) {
      const reasons = data.sensitiveReasons || [];
      return {
        ok: true,
        summary:
          "Screenshot blocked for sensitive context (login/payment). Describe what the user should do locally.",
        keyFacts: reasons.length ? reasons.map(String) : ["sensitive_context"],
        truncated: false,
        imageAttached: false,
        rawRef: runId ? { runId, toolName } : undefined,
      };
    }

    const image = extractImagePayloadFromToolResult(payload);
    const dims = image?.width && image?.height ? `${image.width}×${image.height}` : null;
    const format = image?.format || data.format || "png";
    const sizeKb =
      image?.byteLength != null ? `${Math.round(image.byteLength / 1024)} KB` : null;
    const parts = [dims, format.toUpperCase(), sizeKb].filter(Boolean);
    return {
      ok: true,
      summary: `Screenshot captured${parts.length ? ` (${parts.join(", ")})` : ""}. Image delivered to the user — do not output base64 or repeat raw image data.`,
      keyFacts: [
        data.window?.app ? `window: ${data.window.app}` : null,
        data.url ? `url: ${data.url}` : null,
        dims ? `size: ${dims}` : null,
      ].filter(Boolean),
      truncated: false,
      imageAttached: !!image,
      rawRef: runId ? { runId, toolName } : undefined,
    };
  }

  if (toolName === "brain_recall" || toolName === "brain_what_do_you_know_about") {
    const mems = data.memories || data.results || [];
    for (const m of mems.slice(0, 5)) {
      keyFacts.push(`[${m.type || "memory"}] ${(m.content || m.snippet || "").slice(0, 120)}`);
    }
    const summary = `Recalled ${mems.length} memories for query "${data.query || ""}"`;
    return { ok: true, summary, keyFacts, truncated: mems.length > 5, rawRef: runId ? { runId, toolName } : undefined };
  }

  if (toolName.startsWith("project_context") || toolName === "project_recent_changes") {
    const snippets = data.snippets || data.events || [];
    for (const s of snippets.slice(0, 5)) {
      keyFacts.push(`[${s.type || "snippet"}] ${s.text || s.summary || s.id}`);
    }
    return {
      ok: true,
      summary: `Project context: ${snippets.length} relevant items`,
      keyFacts,
      truncated: snippets.length > 5,
      rawRef: runId ? { runId, toolName } : undefined,
    };
  }

  if (Array.isArray(data)) {
    const arr = summarizeArray(data);
    const json = JSON.stringify(arr);
    return {
      ok: true,
      summary: `Array with ${arr.count} items (showing ${arr.shown})`,
      keyFacts: arr.items.slice(0, 3).map((x) => truncate(JSON.stringify(x), 80)),
      truncated: arr.truncated,
      rawRef: runId ? { runId, toolName } : undefined,
      preview: truncate(json, maxChars),
    };
  }

  if (typeof data === "string") {
    return {
      ok: true,
      summary: truncate(data, 200),
      keyFacts: [],
      truncated: data.length > 200,
      rawRef: runId ? { runId, toolName } : undefined,
      preview: truncate(data, maxChars),
    };
  }

  const json = JSON.stringify(data);
  const truncated = json.length > maxChars;
  return {
    ok: true,
    summary: `${toolName} returned ${truncated ? "large" : "small"} payload`,
    keyFacts: Object.keys(data || {}).slice(0, 8),
    truncated,
    rawRef: runId ? { runId, toolName } : undefined,
    preview: truncate(json, maxChars),
  };
}

/**
 * Format for tool role message content.
 */
export function formatToolResultForModel(summary) {
  return JSON.stringify({
    ok: summary.ok,
    summary: summary.summary,
    keyFacts: summary.keyFacts,
    truncated: summary.truncated,
    rawRef: summary.rawRef,
    preview: summary.preview,
  });
}
