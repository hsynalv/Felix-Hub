/**
 * V7 — Daily briefing item feedback persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const DEFAULT_STORE_PATH = join(config.catalog?.cacheDir || "./cache", "briefing-feedback.json");

function getStorePath() {
  return process.env.BRIEFING_FEEDBACK_PATH || DEFAULT_STORE_PATH;
}

export const BRIEFING_FEEDBACK_TYPES = ["relevant", "not_relevant", "show_less", "show_more"];

function ensureStore() {
  const STORE_PATH = getStorePath();
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ entries: [] }, null, 2), "utf8");
  }
}

function readStore() {
  const STORE_PATH = getStorePath();
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return { entries: Array.isArray(raw.entries) ? raw.entries : [] };
  } catch {
    return { entries: [] };
  }
}

function writeStore(data) {
  const STORE_PATH = getStorePath();
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

export function addBriefingFeedback({ itemId, briefingId = null, feedback, comment = null, source = "web" }) {
  if (!itemId || !BRIEFING_FEEDBACK_TYPES.includes(feedback)) {
    throw Object.assign(new Error("itemId and valid feedback required"), { code: "invalid" });
  }
  const entry = {
    id: `bfb-${randomUUID().slice(0, 8)}`,
    itemId,
    briefingId,
    feedback,
    comment: comment ? String(comment).slice(0, 500) : null,
    source,
    createdAt: new Date().toISOString(),
  };
  const store = readStore();
  store.entries.push(entry);
  if (store.entries.length > 2000) store.entries = store.entries.slice(-2000);
  writeStore(store);
  return entry;
}

export function listBriefingFeedback({ itemId = null, limit = 100 } = {}) {
  let entries = readStore().entries;
  if (itemId) entries = entries.filter((e) => e.itemId === itemId);
  return entries.slice(-limit).reverse();
}

export function getFeedbackSummaryByItem() {
  const map = new Map();
  for (const e of readStore().entries) {
    const cur = map.get(e.itemId) || { notRelevant: 0, showLess: 0, showMore: 0, relevant: 0 };
    if (e.feedback === "not_relevant") cur.notRelevant += 1;
    if (e.feedback === "show_less") cur.showLess += 1;
    if (e.feedback === "show_more") cur.showMore += 1;
    if (e.feedback === "relevant") cur.relevant += 1;
    map.set(e.itemId, cur);
  }
  return map;
}

/** @internal */
export function resetBriefingFeedbackForTests() {
  writeStore({ entries: [] });
}
