/**
 * V7 — External briefing source orchestration (RSS + IMAP).
 */

import {
  listRssFeeds,
  listImapAccounts,
  hasEnabledRssFeeds,
  hasEnabledImapAccounts,
  addRssFeed,
  removeRssFeed,
  addImapAccount,
  removeImapAccount,
  getRssFeed,
  getImapAccount,
  patchRssFeedMeta,
  patchImapAccountMeta,
} from "./briefing-source-store.js";
import { fetchRssFeedItems } from "./rss-connector.service.js";
import { fetchImapMessages, testImapConnection } from "./imap-connector.service.js";

function dedupBriefingItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.dedupKey || item.title || item.id || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeSourceHealth(kind, entries) {
  const enabled = entries.filter((e) => e.enabled);
  if (!enabled.length) {
    return { status: "not_configured", count: 0, errors: [] };
  }
  const errors = enabled.filter((e) => e.lastError).map((e) => ({ id: e.id, label: e.label, error: e.lastError }));
  const healthy = enabled.filter((e) => !e.lastError);
  if (!healthy.length && errors.length) {
    return { status: "error", count: enabled.length, errors };
  }
  if (errors.length) {
    return { status: "degraded", count: enabled.length, errors };
  }
  return { status: "active", count: enabled.length, errors: [] };
}

export function getExternalSourceHealth() {
  const feeds = listRssFeeds();
  const imap = listImapAccounts();
  return {
    rss: summarizeSourceHealth("rss", feeds),
    imap: summarizeSourceHealth("imap", imap),
  };
}

/**
 * Poll all enabled external sources and return normalized briefing items.
 * @param {{ fetchImpl?: typeof fetch, skipImap?: boolean }} opts
 */
export async function collectExternalBriefingItems({ fetchImpl = fetch, skipImap = false } = {}) {
  const items = [];
  const errors = [];

  for (const feed of listRssFeeds().filter((f) => f.enabled)) {
    try {
      const feedItems = await fetchRssFeedItems(feed, { fetchImpl });
      items.push(...feedItems);
    } catch (err) {
      errors.push({ source: "rss", id: feed.id, error: err.message });
      patchRssFeedMeta(feed.id, { lastError: err.message, lastFetchedAt: new Date().toISOString() });
    }
  }

  if (!skipImap) {
    for (const account of listImapAccounts().filter((a) => a.enabled)) {
      try {
        const mailItems = await fetchImapMessages(account);
        items.push(...mailItems);
      } catch (err) {
        errors.push({ source: "imap", id: account.id, error: err.message });
        patchImapAccountMeta(account.id, { lastError: err.message, lastFetchedAt: new Date().toISOString() });
      }
    }
  }

  return {
    items: dedupBriefingItems(items),
    errors,
  };
}

export async function getMailNewsPreview({ limit = 6, fetchImpl = fetch, skipImap = false } = {}) {
  const { items, errors } = await collectExternalBriefingItems({ fetchImpl, skipImap });
  const mail = items.filter((i) => i.source === "imap").slice(0, limit);
  const news = items.filter((i) => i.source === "rss").slice(0, limit);
  const health = getExternalSourceHealth();

  return {
    mail: {
      status: health.imap.status,
      items: mail,
      hint: health.imap.status === "not_configured" ? "IMAP hesabı ekleyin" : undefined,
      errors: health.imap.errors,
    },
    news: {
      status: health.rss.status,
      items: news,
      hint: health.rss.status === "not_configured" ? "RSS feed ekleyin" : undefined,
      errors: health.rss.errors,
    },
    pollErrors: errors,
  };
}

export async function testBriefingSource({ type, id, fetchImpl = fetch }) {
  if (type === "rss") {
    const feed = getRssFeed(id);
    if (!feed) throw new Error("feed not found");
    const items = await fetchRssFeedItems(feed, { limit: 3, fetchImpl });
    return { ok: true, itemCount: items.length, sample: items.slice(0, 2) };
  }
  if (type === "imap") {
    const account = getImapAccount(id);
    if (!account) throw new Error("imap account not found");
    await testImapConnection(account);
    return { ok: true };
  }
  throw new Error("type must be rss or imap");
}

export {
  listRssFeeds,
  listImapAccounts,
  hasEnabledRssFeeds,
  hasEnabledImapAccounts,
  addRssFeed,
  removeRssFeed,
  addImapAccount,
  removeImapAccount,
};
