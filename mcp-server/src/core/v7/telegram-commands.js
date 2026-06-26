/**
 * V7 — Telegram command router (extends notifications webhook).
 */

import { BRAND } from "../branding.js";
import { generateDailyBriefing } from "./daily-briefing.service.js";
import {
  capturePersonalDesktopPreview,
  readPersonalSidecarFile,
  listPersonalSidecarDir,
} from "./personal-desktop.service.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { getApprovalStore } from "../policy-hooks.js";
import { approveTool } from "../tool-registry.js";
import { updateApprovalStatus } from "../../plugins/policy/policy.store.js";
import { cancelRun } from "../agent-runs/run-orchestrator.js";
import {
  rememberPersonal,
  forgetPersonal,
  listPersonalMemory,
} from "./personal-memory.service.js";
import { isHubPaused, setHubPause, clearHubPause, getHubPauseState } from "./telegram-pause.js";
import { sendTelegramWithMarkup, answerCallbackQuery } from "../../plugins/notifications/channels/telegram.js";

function parseArgs(text) {
  const trimmed = text.trim();
  const space = trimmed.indexOf(" ");
  const cmd = space === -1 ? trimmed : trimmed.slice(0, space);
  const rest = space === -1 ? "" : trimmed.slice(space + 1).trim();
  return { cmd: cmd.toLowerCase(), args: rest };
}

export function buildTelegramHelpText() {
  return [
    `${BRAND.assistantName} — ${BRAND.hubName} uzaktan kontrol`,
    "",
    "/brief — günlük özet",
    "/runs — aktif ve bekleyen run'lar",
    "/approve <id> — onay ver",
    "/deny <id> — onayı reddet",
    "/stop [run_id] — run durdur veya hub pause (30 dk)",
    "/resume — hub pause kaldır",
    "/remember <key> = <value> — tercih kaydet",
    "/forget <id> — tercih sil",
    "/memory — tercihleri listele",
    "/desktop screenshot — ekran önizleme (sidecar)",
    "/desktop window — aktif pencere",
    "/file <path> — sidecar dosya oku (kısa)",
    "/file list <dir> — dizin listele",
    "/ask <soru> — agent'a sor",
    "/help — bu mesaj",
  ].join("\n");
}

async function cmdBrief(chatId, reply) {
  const briefing = await generateDailyBriefing({ scope: "personal", persist: true });
  const lines = [briefing.summary, ""];
  for (const item of briefing.items.slice(0, 8)) {
    lines.push(`• [${item.importance}] ${item.title}`);
  }
  if (briefing.items.length > 8) lines.push(`… +${briefing.items.length - 8} madde`);
  await reply(lines.join("\n"));
}

async function cmdRuns(chatId, reply) {
  const runs = await listRuns({ limit: 15 });
  const interesting = runs.filter((r) =>
    ["running", "waiting_approval", "failed", "paused"].includes(r.status)
  );
  if (!interesting.length) {
    await reply("Aktif veya bekleyen run yok.");
    return { inlineKeyboard: null };
  }
  const lines = interesting.slice(0, 10).map(
    (r) => `• ${r.status} — ${r.goal || r.id.slice(0, 8)} (${r.id.slice(0, 8)}…)`
  );
  await reply(["Run'lar:", "", ...lines].join("\n"));

  const store = getApprovalStore();
  const pending = store?.listApprovals?.({ status: "pending" })?.slice(0, 3) || [];
  if (!pending.length) return { inlineKeyboard: null };

  const rows = pending.map((a) => [
    { text: `✓ ${a.toolName || a.id.slice(0, 6)}`, callback_data: `approve:${a.id}` },
    { text: `✗ Reddet`, callback_data: `deny:${a.id}` },
  ]);
  await sendTelegramWithMarkup(chatId, "Bekleyen onaylar — inline seç:", { inline_keyboard: rows });
  return { inlineKeyboard: true };
}

async function cmdApprove(chatId, id, reply) {
  if (!id) {
    await reply("Kullanım: /approve <approval_id>");
    return;
  }
  const result = await approveTool(id, { user: `telegram:${chatId}`, actor: { type: "telegram", chatId } });
  if (result.ok) {
    await reply(`Onaylandı: ${id}`);
    return;
  }
  const rejected = updateApprovalStatus(id, "approved", `telegram:${chatId}`);
  if (rejected) {
    await reply(`Onay kaydı güncellendi: ${id}`);
    return;
  }
  await reply(`Onay bulunamadı: ${id}`);
}

async function cmdDeny(chatId, id, reply) {
  if (!id) {
    await reply("Kullanım: /deny <approval_id>");
    return;
  }
  const approval = updateApprovalStatus(id, "rejected", `telegram:${chatId}`);
  if (!approval) {
    await reply(`Onay bulunamadı: ${id}`);
    return;
  }
  await reply(`Reddedildi: ${id}`);
}

async function cmdStop(chatId, arg, reply) {
  if (arg && arg.length >= 8) {
    const run = await cancelRun(arg, "telegram_stop");
    if (run) {
      await reply(`Run iptal edildi: ${arg}`);
      return;
    }
    await reply(`Run bulunamadı: ${arg}`);
    return;
  }
  const state = setHubPause({ chatId, minutes: 30, reason: "telegram_emergency_stop" });
  await reply(
    `Hub pause aktif (30 dk). Agent mesajları duraklatıldı.\n/resume ile kaldır.\n${state.pausedUntil ? `Bitiş: ${state.pausedUntil}` : ""}`
  );
}

async function cmdRemember(chatId, args, reply) {
  const eq = args.indexOf("=");
  if (eq === -1) {
    await reply("Kullanım: /remember anahtar = değer");
    return;
  }
  const key = args.slice(0, eq).trim();
  const value = args.slice(eq + 1).trim();
  if (!key || !value) {
    await reply("Anahtar ve değer gerekli.");
    return;
  }
  const pref = rememberPersonal({ key, value, scope: "global", pinned: false });
  await reply(`Kaydedildi: ${pref.key} = ${String(pref.value).slice(0, 120)}`);
}

async function cmdForget(chatId, id, reply) {
  if (!id) {
    await reply("Kullanım: /forget <preference_id>");
    return;
  }
  const ok = forgetPersonal(id);
  await reply(ok ? `Silindi: ${id}` : `Bulunamadı: ${id}`);
}

async function cmdDesktop(chatId, args, reply) {
  const sub = (args.split(/\s+/)[0] || "window").toLowerCase();
  if (sub === "screenshot" || sub === "screen") {
    const preview = await capturePersonalDesktopPreview();
    if (preview.blocked) {
      await reply(`Ekran engellendi: hassas içerik veya injection şüphesi.\n${preview.preview || ""}`);
      return;
    }
    const win = preview.activeWindow;
    const shot = preview.screenshot;
    const lines = [
      "Desktop önizleme",
      win ? `Pencere: ${win.app || "?"} — ${win.title || "?"}` : "Pencere bilgisi yok",
      shot?.captured ? `Screenshot: ${shot.width || "?"}×${shot.height || "?"}` : `Screenshot: ${shot?.error || "yok"}`,
      preview.preview ? `\n${preview.preview.slice(0, 500)}` : "",
    ];
    await reply(lines.filter(Boolean).join("\n"));
    return;
  }
  const preview = await capturePersonalDesktopPreview();
  const win = preview.activeWindow;
  if (!win) {
    await reply("Aktif pencere alınamadı. Sidecar eşleşmiş mi kontrol edin.");
    return;
  }
  await reply(`Aktif pencere: ${win.app || "?"} — ${win.title || "?"}`);
}

async function cmdFile(chatId, args, reply) {
  const trimmed = args.trim();
  if (!trimmed) {
    await reply("Kullanım: /file <path> veya /file list <dir>");
    return;
  }
  if (trimmed.toLowerCase().startsWith("list ")) {
    const dir = trimmed.slice(5).trim() || ".";
    const result = await listPersonalSidecarDir(dir);
    if (!result?.ok) {
      await reply(`Liste başarısız: ${result?.error?.message || "sidecar gerekli"}`);
      return;
    }
    const items = result.data?.items || result.data?.entries || [];
    const lines = items.slice(0, 20).map((i) => `• ${i.name || i.path} (${i.type || "file"})`);
    await reply(["Dizin:", dir, "", ...lines].join("\n"));
    return;
  }
  const result = await readPersonalSidecarFile(trimmed, { maxChars: 3000 });
  if (!result?.ok) {
    await reply(`Okuma başarısız: ${result?.error?.message || "sidecar gerekli"}`);
    return;
  }
  const preview = result.data?.preview || "";
  await reply(`Dosya: ${trimmed}\n\n${preview}${result.data?.truncated ? "\n\n…(kısaltıldı)" : ""}`);
}

async function cmdMemory(chatId, reply) {
  const prefs = listPersonalMemory().slice(0, 15);
  if (!prefs.length) {
    await reply("Kayıtlı tercih yok. /remember key = value ile ekle.");
    return;
  }
  const lines = prefs.map((p) => `• ${p.id}: ${p.key} = ${String(p.value).slice(0, 60)}${p.pinned ? " 📌" : ""}`);
  await reply(["Tercihler:", "", ...lines].join("\n"));
}

/**
 * @param {string} chatId
 * @param {string} text
 * @param {{ reply: (msg: string) => Promise<void> }} deps
 */
export async function handleTelegramV7Command(chatId, text, { reply }) {
  const { cmd, args } = parseArgs(text);

  if (cmd === "/brief") {
    await cmdBrief(chatId, reply);
    return { handled: true };
  }
  if (cmd === "/runs") {
    await cmdRuns(chatId, reply);
    return { handled: true };
  }
  if (cmd === "/approve") {
    await cmdApprove(chatId, args.split(/\s/)[0], reply);
    return { handled: true };
  }
  if (cmd === "/deny") {
    await cmdDeny(chatId, args.split(/\s/)[0], reply);
    return { handled: true };
  }
  if (cmd === "/stop") {
    await cmdStop(chatId, args.split(/\s/)[0], reply);
    return { handled: true };
  }
  if (cmd === "/resume") {
    clearHubPause();
    await reply("Hub pause kaldırıldı. Agent mesajları tekrar aktif.");
    return { handled: true };
  }
  if (cmd === "/pause") {
    const state = getHubPauseState();
    await reply(state.paused ? `Pause aktif — ${state.pausedUntil || "süresiz"}` : "Pause yok.");
    return { handled: true };
  }
  if (cmd === "/remember") {
    await cmdRemember(chatId, args, reply);
    return { handled: true };
  }
  if (cmd === "/forget") {
    await cmdForget(chatId, args.split(/\s/)[0], reply);
    return { handled: true };
  }
  if (cmd === "/memory" || cmd === "/show_memory") {
    await cmdMemory(chatId, reply);
    return { handled: true };
  }
  if (cmd === "/desktop") {
    await cmdDesktop(chatId, args, reply);
    return { handled: true };
  }
  if (cmd === "/file") {
    await cmdFile(chatId, args, reply);
    return { handled: true };
  }

  return { handled: false };
}

/**
 * @param {object} callbackQuery
 */
export async function handleTelegramCallbackQuery(callbackQuery) {
  const data = callbackQuery?.data || "";
  const chatId = callbackQuery?.message?.chat?.id;
  const queryId = callbackQuery?.id;
  if (!chatId || !queryId) return { ok: false };

  const [action, id] = data.split(":");
  if (!id) {
    await answerCallbackQuery(queryId, "Geçersiz callback");
    return { ok: false };
  }

  if (action === "approve") {
    const result = await approveTool(id, { user: `telegram:${chatId}` });
    await answerCallbackQuery(queryId, result.ok ? "Onaylandı" : "Onay başarısız");
    return { ok: result.ok };
  }
  if (action === "deny") {
    const approval = updateApprovalStatus(id, "rejected", `telegram:${chatId}`);
    await answerCallbackQuery(queryId, approval ? "Reddedildi" : "Bulunamadı");
    return { ok: !!approval };
  }

  await answerCallbackQuery(queryId, "Bilinmeyen işlem");
  return { ok: false };
}

export { isHubPaused, getHubPauseState };
