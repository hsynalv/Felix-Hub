/**
 * Intent training corpus — seed file + DB entries merge.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { persistenceQuery, isPersistenceHealthy } from "../persistence/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "..", "..", "..", "data", "tool-intent", "seed.corpus.json");

/**
 * @returns {Promise<Array<{ intent: string; utterance: string; locale: string; source?: string }>>}
 */
export async function loadSeedCorpusEntries() {
  if (!existsSync(SEED_PATH)) return [];
  const data = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  return (data.entries || []).map((e) => ({
    intent: e.intent,
    utterance: e.utterance,
    locale: e.locale || "tr",
    source: "seed",
  }));
}

/**
 * @returns {Promise<Array<{ intent: string; utterance: string; locale: string; source: string; id?: string }>>}
 */
export async function loadActiveCorpusEntries() {
  const seed = await loadSeedCorpusEntries();
  if (!isPersistenceHealthy()) return seed;

  const result = await persistenceQuery(
    `SELECT id, intent, utterance, locale, source FROM intent_corpus_entries WHERE active = 1`
  );
  const db = (result?.recordset ?? []).map((r) => ({
    id: r.id,
    intent: r.intent,
    utterance: r.utterance,
    locale: r.locale || "tr",
    source: r.source || "manual",
  }));
  return [...seed, ...db];
}

/**
 * @param {{ intent: string; utterance: string; locale?: string; source?: string; sampleId?: string }} entry
 */
export async function addCorpusEntry(entry) {
  if (!isPersistenceHealthy()) {
    throw Object.assign(new Error("Persistence unavailable"), { code: "persistence_unavailable" });
  }
  const id = randomUUID();
  await persistenceQuery(
    `INSERT INTO intent_corpus_entries (id, intent, utterance, locale, source, sample_id, active)
     VALUES (@id, @intent, @utterance, @locale, @source, @sampleId, 1)`,
    {
      id,
      intent: entry.intent,
      utterance: entry.utterance.slice(0, 2000),
      locale: entry.locale || "tr",
      source: entry.source || "manual",
      sampleId: entry.sampleId || null,
    }
  );
  return { id, ...entry };
}

/**
 * @param {string} sampleId
 * @param {string} intent
 * @param {string} utterance
 * @param {string} source
 */
export async function addCorpusFromSample(sampleId, intent, utterance, source = "llm") {
  return addCorpusEntry({
    intent,
    utterance,
    locale: /[çğıöşü]/i.test(utterance) ? "tr" : "en",
    source,
    sampleId,
  });
}

export async function listCorpusEntries({ intent, limit = 200 } = {}) {
  const entries = await loadActiveCorpusEntries();
  let list = entries;
  if (intent) list = list.filter((e) => e.intent === intent);
  return list.slice(0, limit);
}

export async function exportCorpusJson() {
  const entries = await loadActiveCorpusEntries();
  return { version: 1, exportedAt: new Date().toISOString(), entries };
}

/**
 * @param {string} id
 * @param {boolean} active
 */
export async function setCorpusEntryActive(id, active) {
  if (!isPersistenceHealthy()) return false;
  await persistenceQuery(`UPDATE intent_corpus_entries SET active = @active WHERE id = @id`, {
    id,
    active: active ? 1 : 0,
  });
  return true;
}