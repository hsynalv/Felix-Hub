/**
 * V7 — Gmail API connector for daily briefing (OAuth read-only).
 */

import { patchGmailAccountMeta } from "./briefing-source-store.js";
import { createGmailClientForAccount } from "./gmail-oauth.service.js";

const IMPORTANT_SUBJECT_RE =
  /\b(urgent|acil|önemli|important|action required|deadline|fatura|invoice|security|güvenlik)\b/i;

function scoreMail({ subject, unread, from }) {
  let score = 50;
  if (unread) score += 20;
  if (IMPORTANT_SUBJECT_RE.test(subject || "")) score += 25;
  if (from && /@(google|github|stripe|paypal|bank)/i.test(from)) score += 10;
  return Math.min(score, 95);
}

function decodeHeader(headers, name) {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

/**
 * @param {{ id: string, email: string, label?: string, refreshToken: string, maxMessages?: number }} account
 */
export async function fetchGmailMessages(account) {
  const gmail = createGmailClientForAccount(account);
  const max = account.maxMessages ?? 15;
  const after = new Date();
  after.setDate(after.getDate() - 2);
  const q = `after:${Math.floor(after.getTime() / 1000)}`;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: max,
    q,
  });

  const messages = [];
  for (const ref of listRes.data.messages || []) {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: ref.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const headers = msgRes.data.payload?.headers || [];
    const subject = decodeHeader(headers, "Subject") || "(no subject)";
    const from = decodeHeader(headers, "From") || "unknown";
    const unread = (msgRes.data.labelIds || []).includes("UNREAD");
    const internalDate = msgRes.data.internalDate
      ? new Date(parseInt(msgRes.data.internalDate, 10)).toISOString()
      : new Date().toISOString();

    messages.push({
      id: `gmail:${account.id}:${ref.id}`,
      source: "gmail",
      sourceId: account.id,
      sourceLabel: account.label || account.email,
      title: subject,
      body: `From: ${from}${unread ? " · unread" : ""}`,
      importance: scoreMail({ subject, unread, from }),
      actionRequired: unread && IMPORTANT_SUBJECT_RE.test(subject),
      link: `https://mail.google.com/mail/u/0/#inbox/${ref.id}`,
      href: `https://mail.google.com/mail/u/0/#inbox/${ref.id}`,
      createdAt: internalDate,
      dedupKey: `gmail:${account.id}:${ref.id}`,
      meta: { from, unread, messageId: ref.id },
    });
  }

  patchGmailAccountMeta(account.id, {
    lastFetchedAt: new Date().toISOString(),
    lastError: null,
    messageCount: messages.length,
  });

  return messages.sort((a, b) => b.importance - a.importance);
}

export async function testGmailConnection(account) {
  await fetchGmailMessages({ ...account, maxMessages: 1 });
  return { ok: true };
}
