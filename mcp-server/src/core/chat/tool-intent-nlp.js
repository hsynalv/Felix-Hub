/**
 * NLP.js wrapper — load, train, predict, hot-reload.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Nlp } from "@nlpjs/nlp";
import { LangEn } from "@nlpjs/lang-en";
import { LangTr } from "@nlpjs/lang-tr";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MODELS_DIR = join(__dirname, "..", "..", "..", "data", "tool-intent", "models");
const ACTIVE_MANIFEST = join(MODELS_DIR, "active.json");

/** @type {import('@nlpjs/nlp').Nlp | null} */
let nlpInstance = null;
/** @type {{ version: number; trainedAt: string } | null} */
let activeManifest = null;
let initPromise = null;

const TR_HINT = /[çğıöşüÇĞİÖŞÜ]|(?:\b(?:ne|bir|bu|için|projede|kaydet)\b)/i;

/**
 * @param {string} text
 * @returns {"tr"|"en"}
 */
export function detectLocale(text) {
  return TR_HINT.test(text) ? "tr" : "en";
}

function createNlp() {
  const nlp = new Nlp({ languages: ["tr", "en"], forceNER: true, autoSave: false });
  nlp.use(LangEn);
  nlp.use(LangTr);
  return nlp;
}

/**
 * @param {Array<{ intent: string; utterance: string; locale?: string }>} entries
 */
export async function trainNlpFromEntries(entries) {
  const nlp = createNlp();
  for (const e of entries) {
    const locale = e.locale || detectLocale(e.utterance);
    nlp.addDocument(locale, e.utterance, e.intent);
  }
  await nlp.train();
  return nlp;
}

/**
 * @param {import('@nlpjs/nlp').Nlp} nlp
 * @param {number} version
 */
export function saveNlpModel(nlp, version) {
  mkdirSync(MODELS_DIR, { recursive: true });
  const modelPath = join(MODELS_DIR, `v${version}.json`);
  const exported = nlp.export();
  writeFileSync(modelPath, JSON.stringify(exported));
  const manifest = {
    version,
    modelPath: `v${version}.json`,
    trainedAt: new Date().toISOString(),
  };
  writeFileSync(ACTIVE_MANIFEST, JSON.stringify(manifest, null, 2));
  activeManifest = manifest;
  nlpInstance = nlp;
  return manifest;
}

/**
 * @param {number} [version]
 */
export async function loadNlpModel(version) {
  mkdirSync(MODELS_DIR, { recursive: true });
  let manifest = null;
  if (version != null) {
    const modelPath = join(MODELS_DIR, `v${version}.json`);
    if (!existsSync(modelPath)) return false;
    manifest = { version, modelPath: `v${version}.json` };
  } else if (existsSync(ACTIVE_MANIFEST)) {
    manifest = JSON.parse(readFileSync(ACTIVE_MANIFEST, "utf8"));
  } else {
    return false;
  }

  const modelPath = join(MODELS_DIR, manifest.modelPath);
  if (!existsSync(modelPath)) return false;

  const nlp = createNlp();
  nlp.import(JSON.parse(readFileSync(modelPath, "utf8")));
  nlpInstance = nlp;
  activeManifest = manifest;
  return true;
}

export async function ensureNlpLoaded() {
  if (nlpInstance) return true;
  if (!initPromise) {
    initPromise = (async () => {
      const loaded = await loadNlpModel();
      if (!loaded) {
        const { loadSeedCorpusEntries } = await import("./tool-intent-corpus.js");
        const entries = await loadSeedCorpusEntries();
        if (entries.length) {
          const nlp = await trainNlpFromEntries(entries);
          saveNlpModel(nlp, 1);
          return true;
        }
      }
      return loaded;
    })();
  }
  return initPromise;
}

export function reloadNlpModel() {
  nlpInstance = null;
  activeManifest = null;
  initPromise = null;
  return loadNlpModel();
}

export function getActiveModelVersion() {
  return activeManifest?.version ?? null;
}

/**
 * @param {string} message
 * @returns {{ intent: string; confidence: number; locale: string } | null}
 */
export async function classifyWithNlp(message) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length < 3) return null;

  await ensureNlpLoaded();
  if (!nlpInstance) return null;

  const locale = detectLocale(text);
  const result = await nlpInstance.process(locale, text);
  const intent = result?.intent || "general";
  const score = typeof result?.score === "number" ? result.score : 0;
  if (!intent || intent === "None") {
    return { intent: "general", confidence: 0.3, locale };
  }
  return { intent, confidence: score, locale };
}

/** Test isolation */
export function resetNlpForTests() {
  nlpInstance = null;
  activeManifest = null;
  initPromise = null;
}
