/**
 * V7 — Briefing external source registry (RSS feeds + IMAP accounts).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const DEFAULT_STORE_PATH = join(config.catalog?.cacheDir || "./cache", "briefing-sources.json");

function getStorePath() {
  return process.env.BRIEFING_SOURCE_STORE_PATH || DEFAULT_STORE_PATH;
}

function ensureStore() {
  const STORE_PATH = getStorePath();
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(
      STORE_PATH,
      JSON.stringify({ feeds: [], imapAccounts: [], gmailAccounts: [] }, null, 2),
      "utf8",
    );
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(getStorePath(), "utf8"));
    return {
      feeds: Array.isArray(raw.feeds) ? raw.feeds : [],
      imapAccounts: Array.isArray(raw.imapAccounts) ? raw.imapAccounts : [],
      gmailAccounts: Array.isArray(raw.gmailAccounts) ? raw.gmailAccounts : [],
    };
  } catch {
    return { feeds: [], imapAccounts: [], gmailAccounts: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(
    getStorePath(),
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

function normalizeFeed(feed) {
  return {
    id: feed.id,
    url: feed.url,
    label: feed.label || feed.url,
    enabled: feed.enabled !== false,
    pollIntervalMinutes: feed.pollIntervalMinutes ?? 60,
    etag: feed.etag || null,
    lastModified: feed.lastModified || null,
    lastFetchedAt: feed.lastFetchedAt || null,
    lastError: feed.lastError || null,
    itemCount: feed.itemCount ?? 0,
    createdAt: feed.createdAt || new Date().toISOString(),
    updatedAt: feed.updatedAt || new Date().toISOString(),
  };
}

function normalizeImap(account) {
  return {
    id: account.id,
    label: account.label || account.user || "IMAP",
    host: account.host,
    port: account.port ?? 993,
    secure: account.secure !== false,
    user: account.user,
    passwordEnvKey: account.passwordEnvKey,
    mailbox: account.mailbox || "INBOX",
    enabled: account.enabled !== false,
    maxMessages: account.maxMessages ?? 15,
    lastFetchedAt: account.lastFetchedAt || null,
    lastError: account.lastError || null,
    messageCount: account.messageCount ?? 0,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: account.updatedAt || new Date().toISOString(),
  };
}

function normalizeGmail(account) {
  return {
    id: account.id,
    email: account.email,
    label: account.label || account.email,
    refreshToken: account.refreshToken,
    enabled: account.enabled !== false,
    maxMessages: account.maxMessages ?? 15,
    lastFetchedAt: account.lastFetchedAt || null,
    lastError: account.lastError || null,
    messageCount: account.messageCount ?? 0,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: account.updatedAt || new Date().toISOString(),
  };
}

function sanitizeGmailForApi(account) {
  const n = normalizeGmail(account);
  return {
    id: n.id,
    email: n.email,
    label: n.label,
    enabled: n.enabled,
    maxMessages: n.maxMessages,
    lastFetchedAt: n.lastFetchedAt,
    lastError: n.lastError,
    messageCount: n.messageCount,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    hasRefreshToken: !!n.refreshToken,
  };
}

export function resetBriefingSourceStoreForTests() {
  writeStore({ feeds: [], imapAccounts: [], gmailAccounts: [] });
}

export function listRssFeeds() {
  return readStore().feeds.map(normalizeFeed);
}

export function getRssFeed(id) {
  return listRssFeeds().find((f) => f.id === id) || null;
}

export function addRssFeed({ url, label, pollIntervalMinutes, enabled = true }) {
  if (!url || typeof url !== "string") {
    throw new Error("url is required");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid feed url");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("feed url must be http or https");
  }

  const store = readStore();
  if (store.feeds.some((f) => f.url === url)) {
    throw new Error("feed url already registered");
  }

  const feed = normalizeFeed({
    id: `feed-${randomUUID().slice(0, 8)}`,
    url,
    label: label || parsed.hostname,
    pollIntervalMinutes,
    enabled,
    createdAt: new Date().toISOString(),
  });
  store.feeds.push(feed);
  writeStore(store);
  return feed;
}

export function removeRssFeed(id) {
  const store = readStore();
  const before = store.feeds.length;
  store.feeds = store.feeds.filter((f) => f.id !== id);
  if (store.feeds.length === before) return false;
  writeStore(store);
  return true;
}

export function patchRssFeedMeta(id, patch) {
  const store = readStore();
  const idx = store.feeds.findIndex((f) => f.id === id);
  if (idx < 0) return null;
  store.feeds[idx] = normalizeFeed({
    ...store.feeds[idx],
    ...patch,
    id: store.feeds[idx].id,
    url: store.feeds[idx].url,
    updatedAt: new Date().toISOString(),
  });
  writeStore(store);
  return store.feeds[idx];
}

export function listImapAccounts() {
  return readStore().imapAccounts.map(normalizeImap);
}

export function getImapAccount(id) {
  return listImapAccounts().find((a) => a.id === id) || null;
}

export function addImapAccount({
  host,
  port,
  secure = true,
  user,
  passwordEnvKey,
  label,
  mailbox,
  maxMessages,
  enabled = true,
}) {
  if (!host || !user || !passwordEnvKey) {
    throw new Error("host, user, and passwordEnvKey are required");
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(passwordEnvKey)) {
    throw new Error("passwordEnvKey must be an env var name (e.g. BRIEFING_IMAP_PASS)");
  }

  const store = readStore();
  const account = normalizeImap({
    id: `imap-${randomUUID().slice(0, 8)}`,
    host,
    port,
    secure,
    user,
    passwordEnvKey,
    label: label || user,
    mailbox,
    maxMessages,
    enabled,
    createdAt: new Date().toISOString(),
  });
  store.imapAccounts.push(account);
  writeStore(store);
  return account;
}

export function removeImapAccount(id) {
  const store = readStore();
  const before = store.imapAccounts.length;
  store.imapAccounts = store.imapAccounts.filter((a) => a.id !== id);
  if (store.imapAccounts.length === before) return false;
  writeStore(store);
  return true;
}

export function patchImapAccountMeta(id, patch) {
  const store = readStore();
  const idx = store.imapAccounts.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const current = store.imapAccounts[idx];
  store.imapAccounts[idx] = normalizeImap({
    ...current,
    ...patch,
    id: current.id,
    host: current.host,
    user: current.user,
    passwordEnvKey: current.passwordEnvKey,
    updatedAt: new Date().toISOString(),
  });
  writeStore(store);
  return store.imapAccounts[idx];
}

export function hasEnabledRssFeeds() {
  return listRssFeeds().some((f) => f.enabled);
}

export function hasEnabledImapAccounts() {
  return listImapAccounts().some((a) => a.enabled);
}

export function listGmailAccounts() {
  return readStore().gmailAccounts.map(normalizeGmail);
}

export function listGmailAccountsForApi() {
  return readStore().gmailAccounts.map(sanitizeGmailForApi);
}

export function getGmailAccount(id) {
  return listGmailAccounts().find((a) => a.id === id) || null;
}

export function addGmailAccount({ email, label, refreshToken, maxMessages, enabled = true }) {
  if (!email || !refreshToken) {
    throw new Error("email and refreshToken are required");
  }
  const store = readStore();
  if (store.gmailAccounts.some((a) => a.email === email)) {
    throw new Error("gmail account already registered");
  }
  const account = normalizeGmail({
    id: `gmail-${randomUUID().slice(0, 8)}`,
    email,
    label: label || email,
    refreshToken,
    maxMessages,
    enabled,
    createdAt: new Date().toISOString(),
  });
  store.gmailAccounts.push(account);
  writeStore(store);
  return sanitizeGmailForApi(account);
}

export function removeGmailAccount(id) {
  const store = readStore();
  const before = store.gmailAccounts.length;
  store.gmailAccounts = store.gmailAccounts.filter((a) => a.id !== id);
  if (store.gmailAccounts.length === before) return false;
  writeStore(store);
  return true;
}

export function patchGmailAccountMeta(id, patch) {
  const store = readStore();
  const idx = store.gmailAccounts.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const current = store.gmailAccounts[idx];
  store.gmailAccounts[idx] = normalizeGmail({
    ...current,
    ...patch,
    id: current.id,
    email: current.email,
    refreshToken: patch.refreshToken ?? current.refreshToken,
    updatedAt: new Date().toISOString(),
  });
  writeStore(store);
  return sanitizeGmailForApi(store.gmailAccounts[idx]);
}

export function hasEnabledGmailAccounts() {
  return listGmailAccounts().some((a) => a.enabled && a.refreshToken);
}
