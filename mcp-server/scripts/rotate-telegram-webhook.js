#!/usr/bin/env node
/**
 * Generate new TELEGRAM_WEBHOOK_SECRET, save to owner settings, register with Telegram.
 * Usage: node scripts/rotate-telegram-webhook.js
 */

import { randomBytes } from "crypto";
import "dotenv/config";
import { initPersistence } from "../src/core/persistence/index.js";
import { initMasterKey } from "../src/core/settings/crypto.js";
import { upsertSetting } from "../src/core/settings/settings.service.js";
import { loadOwnerIntegrationOverlay } from "../src/core/settings/effective-config.js";
import { getTelegramConfig } from "../src/plugins/notifications/channels/telegram.js";
import { persistenceQuery, isPersistenceHealthy } from "../src/core/persistence/index.js";
import { userNamespaceForId } from "../src/core/auth/request-context.js";

const WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  "https://asistan.huseyinalav.com/notifications/telegram/webhook";

async function ownerNamespace() {
  const result = await persistenceQuery(
    `SELECT TOP 1 id FROM hub_users ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC`
  );
  const id = result?.recordset?.[0]?.id;
  if (!id) throw new Error("No hub_users row found");
  return userNamespaceForId(id);
}

async function main() {
  await initPersistence();
  if (!isPersistenceHealthy()) throw new Error("Persistence not healthy");
  initMasterKey();

  const secret = randomBytes(24).toString("hex");
  const namespace = await ownerNamespace();

  await upsertSetting("TELEGRAM_WEBHOOK_SECRET", secret, {
    namespace,
    updatedBy: "rotate-telegram-webhook",
  });
  await loadOwnerIntegrationOverlay();

  const { token } = getTelegramConfig();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const params = new URLSearchParams({
    url: WEBHOOK_URL,
    secret_token: secret,
    drop_pending_updates: "true",
  });

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params}`);
  const data = await res.json();

  if (!res.ok || !data.ok) {
    console.error("setWebhook failed:", data);
    process.exit(1);
  }

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();

  console.log("OK — TELEGRAM_WEBHOOK_SECRET rotated and saved");
  console.log("namespace:", namespace);
  console.log("webhook_url:", WEBHOOK_URL);
  console.log("new_secret:", secret);
  console.log("telegram_webhook:", info.result?.url || "(none)");
  console.log("pending_update_count:", info.result?.pending_update_count ?? "?");
  if (info.result?.last_error_message) {
    console.warn("last_error:", info.result.last_error_message);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
