/**
 * Desktop notification — OS-native when available.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { BRAND } from "../../core/branding.js";

const execFileAsync = promisify(execFile);

export async function sendDesktopNotification({ title, message } = {}) {
  const t = String(title || BRAND.hubName).slice(0, 120);
  const m = String(message || "").slice(0, 500);
  if (!m) return { ok: false, error: { code: "empty_message", message: "message required" } };

  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const script = `display notification ${JSON.stringify(m)} with title ${JSON.stringify(t)}`;
      await execFileAsync("osascript", ["-e", script], { timeout: 5000 });
      return { ok: true, data: { platform, title: t, delivered: true } };
    }
    if (platform === "linux") {
      await execFileAsync("notify-send", [t, m], { timeout: 5000 });
      return { ok: true, data: { platform, title: t, delivered: true } };
    }
    if (platform === "win32") {
      const ps = `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; $xml.LoadXml('<toast><visual><binding template="ToastText"><text id="1">${t.replace(/</g, "")}</text><text id="2">${m.replace(/</g, "")}</text></binding></visual></toast>'); $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("${BRAND.hubName}").Show($toast)`;
      await execFileAsync("powershell", ["-Command", ps], { timeout: 8000 });
      return { ok: true, data: { platform, title: t, delivered: true } };
    }
    return { ok: true, data: { platform, title: t, delivered: false, reason: "unsupported_platform" } };
  } catch (err) {
    return { ok: false, error: { code: "notify_failed", message: err.message } };
  }
}
