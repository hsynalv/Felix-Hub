/**
 * Desktop control — observe (screenshot, active window, OCR) + assisted actions (click, type).
 * Local-only; invoked via sidecar daemon on 127.0.0.1.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { assertDesktopActionAllowed } from "./desktop-guard.js";

const execFileAsync = promisify(execFile);

async function runOsascript(script) {
  const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 10_000 });
  return stdout.trim();
}

async function currentWindowContext() {
  const win = await getActiveWindow();
  if (!win.ok) return { app: "", title: "" };
  return { app: win.data?.app || "", title: win.data?.title || "" };
}

export async function captureScreenshot({ format = "png" } = {}) {
  const platform = process.platform;
  if (platform !== "darwin") {
    return {
      ok: true,
      data: {
        platform,
        stub: true,
        message: "Screenshot capture requires macOS sidecar with Screen Recording permission",
        imageBase64: null,
        width: null,
        height: null,
      },
    };
  }

  const ext = format === "jpg" ? "jpg" : "png";
  const outPath = join(tmpdir(), `mcp-hub-screenshot-${randomUUID()}.${ext}`);
  try {
    await execFileAsync("screencapture", ["-x", `-t${ext}`, outPath], { timeout: 15_000 });
    const buf = await readFile(outPath);
    return {
      ok: true,
      data: {
        platform,
        format: ext,
        imageBase64: buf.toString("base64"),
        byteLength: buf.length,
        capturedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "screenshot_failed",
        message: err.message,
        hint: "Grant Screen Recording permission to Terminal or the sidecar process",
      },
    };
  } finally {
    await unlink(outPath).catch(() => {});
  }
}

export async function getActiveWindow() {
  const platform = process.platform;

  if (platform === "darwin") {
    try {
      const app = await runOsascript(
        'tell application "System Events" to get name of first application process whose frontmost is true'
      );
      const title = await runOsascript(
        'tell application "System Events" to get title of front window of (first application process whose frontmost is true)'
      ).catch(() => "");
      return {
        ok: true,
        data: { platform, app, title, capturedAt: new Date().toISOString() },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "active_window_failed",
          message: err.message,
          hint: "Grant Accessibility permission to the sidecar process",
        },
      };
    }
  }

  if (platform === "win32") {
    try {
      const ps = `(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object -Property @{Expression={$_.MainWindowHandle -ne 0}} -Descending | Select-Object -First 1 | ForEach-Object { $_.ProcessName + '|' + $_.MainWindowTitle })`;
      const { stdout } = await execFileAsync("powershell", ["-Command", ps], { timeout: 8000 });
      const [app, title] = String(stdout).trim().split("|");
      return { ok: true, data: { platform, app: app || "unknown", title: title || "" } };
    } catch (err) {
      return { ok: false, error: { code: "active_window_failed", message: err.message } };
    }
  }

  return {
    ok: true,
    data: {
      platform,
      stub: true,
      app: "unknown",
      title: "",
      message: "Active window detection not implemented for this platform",
    },
  };
}

async function ocrWithTesseract(imageBase64) {
  const inPath = join(tmpdir(), `mcp-hub-ocr-in-${randomUUID()}.png`);
  const outBase = join(tmpdir(), `mcp-hub-ocr-out-${randomUUID()}`);
  try {
    await writeFile(inPath, Buffer.from(imageBase64, "base64"));
    await execFileAsync("tesseract", [inPath, outBase, "-l", "eng"], { timeout: 30_000 });
    const text = await readFile(`${outBase}.txt`, "utf8");
    return text.trim();
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(`${outBase}.txt`).catch(() => {});
  }
}

/** OCR via tesseract when installed; otherwise returns stub hint. */
export async function ocrScreenRegion({ imageBase64 } = {}) {
  if (!imageBase64) {
    return { ok: false, error: { code: "missing_image", message: "imageBase64 required (from desktop_screenshot)" } };
  }

  const byteLength = Buffer.from(imageBase64, "base64").length;

  try {
    const { stdout } = await execFileAsync("which", ["tesseract"], { timeout: 3000 });
    if (stdout.trim()) {
      const text = await ocrWithTesseract(imageBase64);
      return {
        ok: true,
        data: {
          stub: false,
          text,
          engine: "tesseract",
          byteLength,
        },
      };
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      return {
        ok: false,
        error: { code: "ocr_failed", message: err.message, byteLength },
      };
    }
  }

  return {
    ok: true,
    data: {
      stub: true,
      text: "",
      hint: "Install tesseract (brew install tesseract) or pass screenshot to a vision model for OCR",
      byteLength,
    },
  };
}

export async function desktopClick({ x, y, button = "left" } = {}) {
  const { app, title } = await currentWindowContext();
  const guard = assertDesktopActionAllowed({ action: "click", app, title, x, y });
  if (!guard.ok) return guard;

  const platform = process.platform;
  if (platform === "darwin") {
    try {
      await execFileAsync("cliclick", [`${button}:${x},${y}`], { timeout: 5000 });
      return { ok: true, data: { x, y, button, platform, preview: guard.data.preview } };
    } catch {
      try {
        await runOsascript(`tell application "System Events" to click at {${x}, ${y}}`);
        return {
          ok: true,
          data: { x, y, button, platform, method: "osascript", preview: guard.data.preview },
        };
      } catch (err) {
        return {
          ok: false,
          error: {
            code: "click_failed",
            message: err.message,
            hint: "Install cliclick (brew install cliclick) or grant Accessibility permission",
            preview: guard.data?.preview,
          },
        };
      }
    }
  }

  return {
    ok: false,
    error: { code: "unsupported_platform", message: `desktop_click not supported on ${platform}` },
  };
}

export async function desktopType({ text, delayMs = 0 } = {}) {
  if (!text) {
    return { ok: false, error: { code: "empty_text", message: "text required" } };
  }

  const { app, title } = await currentWindowContext();
  const guard = assertDesktopActionAllowed({ action: "type", app, title });
  if (!guard.ok) return guard;

  const platform = process.platform;
  if (platform === "darwin") {
    try {
      const escaped = String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await runOsascript(`tell application "System Events" to keystroke "${escaped}"`);
      return {
        ok: true,
        data: { length: text.length, platform, delayMs, preview: guard.data.preview },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "type_failed",
          message: err.message,
          hint: "Grant Accessibility permission to the sidecar process",
          preview: guard.data?.preview,
        },
      };
    }
  }

  return {
    ok: false,
    error: { code: "unsupported_platform", message: `desktop_type not supported on ${platform}` },
  };
}
