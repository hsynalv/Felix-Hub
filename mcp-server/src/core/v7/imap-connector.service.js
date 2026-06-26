/**
 * V7 — IMAP connector for daily briefing (read-only triage).
 */

import { patchImapAccountMeta } from "./briefing-source-store.js";

const IMPORTANT_SUBJECT_RE =
  /\b(urgent|acil|önemli|important|action required|deadline|fatura|invoice|security|güvenlik)\b/i;

function scoreMail({ subject, unseen, from }) {
  let score = 50;
  if (unseen) score += 20;
  if (IMPORTANT_SUBJECT_RE.test(subject || "")) score += 25;
  if (from && /@(google|github|stripe|paypal|bank)/i.test(from)) score += 10;
  return Math.min(score, 95);
}

function resolvePassword(account) {
  const pass = process.env[account.passwordEnvKey];
  if (!pass) {
    throw new Error(`password env ${account.passwordEnvKey} is not set`);
  }
  return pass;
}

/**
 * @param {{ id: string, host: string, port?: number, secure?: boolean, user: string, passwordEnvKey: string, mailbox?: string, maxMessages?: number, label?: string }} account
 */
export async function fetchImapMessages(account) {
  let ImapFlow;
  try {
    ({ ImapFlow } = await import("imapflow"));
  } catch {
    throw new Error("imapflow package is required for IMAP briefing sources");
  }

  const client = new ImapFlow({
    host: account.host,
    port: account.port ?? 993,
    secure: account.secure !== false,
    auth: {
      user: account.user,
      pass: resolvePassword(account),
    },
    logger: false,
    tls: { rejectUnauthorized: process.env.BRIEFING_IMAP_TLS_INSECURE !== "true" },
  });

  const since = new Date();
  since.setDate(since.getDate() - 2);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(account.mailbox || "INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      const recentUids = uids.slice(-(account.maxMessages ?? 15));
      const messages = [];

      for await (const msg of client.fetch(recentUids, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
      })) {
        const subject = msg.envelope?.subject || "(no subject)";
        const from = msg.envelope?.from?.[0]
          ? `${msg.envelope.from[0].name || ""} <${msg.envelope.from[0].address}>`.trim()
          : "unknown";
        const unseen = !msg.flags?.has("\\Seen");
        const createdAt = (msg.internalDate || new Date()).toISOString();

        messages.push({
          id: `imap:${account.id}:${msg.uid}`,
          source: "imap",
          sourceId: account.id,
          sourceLabel: account.label || account.user,
          title: subject,
          body: `From: ${from}${unseen ? " · unread" : ""}`,
          importance: scoreMail({ subject, unseen, from }),
          actionRequired: unseen && IMPORTANT_SUBJECT_RE.test(subject),
          href: null,
          createdAt,
          dedupKey: `imap:${account.id}:${msg.uid}`,
          meta: { from, unseen, uid: msg.uid },
        });
      }

      patchImapAccountMeta(account.id, {
        lastFetchedAt: new Date().toISOString(),
        lastError: null,
        messageCount: messages.length,
      });

      return messages.sort((a, b) => b.importance - a.importance);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Test IMAP credentials without persisting messages.
 */
export async function testImapConnection(account) {
  await fetchImapMessages({ ...account, maxMessages: 1 });
  return { ok: true };
}
