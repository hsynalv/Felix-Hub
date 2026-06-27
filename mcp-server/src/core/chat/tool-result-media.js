/**
 * Screenshot / image tool results — strip binary payloads from LLM + SSE traces.
 */

export const SCREENSHOT_TOOL_NAMES = new Set([
  "desktop_screenshot",
  "desktop_region_screenshot",
  "desktop_window_screenshot",
  "browser_screenshot",
]);

export function isScreenshotToolName(toolName) {
  return SCREENSHOT_TOOL_NAMES.has(toolName);
}

/**
 * @param {unknown} result
 * @returns {{ mimeType: string; base64: string; format?: string; width?: number | null; height?: number | null; byteLength?: number } | null}
 */
export function extractImagePayloadFromToolResult(result) {
  const data = result?.data ?? result;
  if (!data || typeof data !== "object") return null;
  const base64 = data.imageBase64 || data.base64;
  if (typeof base64 !== "string" || !base64.trim()) return null;
  const format = String(data.format || "png").toLowerCase().replace(/^\./, "");
  const mimeType = format === "jpg" || format === "jpeg" ? "image/jpeg" : "image/png";
  return {
    mimeType,
    base64: base64.trim(),
    format,
    width: data.width ?? null,
    height: data.height ?? null,
    byteLength: data.byteLength ?? null,
  };
}

/**
 * @param {unknown} result
 * @returns {unknown}
 */
export function redactBinaryFieldsFromToolResult(result) {
  if (!result || typeof result !== "object") return result;
  const clone = { ...result };
  if (clone.data && typeof clone.data === "object") {
    const data = { ...clone.data };
    if ("imageBase64" in data) data.imageBase64 = "[redacted:image]";
    if ("base64" in data) data.base64 = "[redacted:image]";
    clone.data = data;
  }
  return clone;
}

/**
 * @param {{ phase?: string; name?: string; result?: unknown; [key: string]: unknown }} payload
 */
export function sanitizeToolStreamPayload(payload) {
  if (!payload || payload.phase !== "end" || !isScreenshotToolName(payload.name)) {
    return payload;
  }
  if (!payload.result) return payload;
  return {
    ...payload,
    result: redactBinaryFieldsFromToolResult(payload.result),
  };
}

/**
 * @param {string} toolName
 * @param {unknown} result
 */
export function buildScreenshotAttachment(toolName, result) {
  if (!result?.ok) return null;
  if (result.data?.deliveryBlocked || result.data?.sensitiveContext) return null;

  const image = extractImagePayloadFromToolResult(result);
  if (!image) return null;

  const dims =
    image.width && image.height ? `${image.width}×${image.height}` : null;
  const sizeKb =
    image.byteLength != null ? `${Math.round(image.byteLength / 1024)} KB` : null;
  const meta = [dims, sizeKb].filter(Boolean).join(", ");

  let caption = "Ekran görüntüsü";
  if (toolName === "browser_screenshot") {
    caption = result.data?.url ? `Tarayıcı — ${result.data.url}` : "Tarayıcı ekran görüntüsü";
  } else if (toolName === "desktop_window_screenshot") {
    const win = result.data?.window;
    caption = win?.app ? `${win.app} penceresi` : "Pencere ekran görüntüsü";
  } else if (toolName === "desktop_region_screenshot") {
    caption = "Bölge ekran görüntüsü";
  }
  if (meta) caption = `${caption} (${meta})`;

  return {
    kind: "image",
    toolName,
    mimeType: image.mimeType,
    dataUrl: `data:${image.mimeType};base64,${image.base64}`,
    width: image.width,
    height: image.height,
    caption,
  };
}
