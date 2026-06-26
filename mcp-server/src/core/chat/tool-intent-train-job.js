/**
 * Intent training jobs — label + train + promote.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { registerJobRunner, submitJob } from "../jobs.js";
import { getIntentTrainConfig } from "./tool-intent-config.js";
import { loadActiveCorpusEntries } from "./tool-intent-corpus.js";
import { runLabelingBatch } from "./tool-intent-labeler.js";
import {
  trainNlpFromEntries,
  saveNlpModel,
  reloadNlpModel,
  loadNlpModel,
  getActiveModelVersion,
  MODELS_DIR,
} from "./tool-intent-nlp.js";
import { classifyToolIntentRegex } from "./tool-intent.js";
import { persistenceQuery, isPersistenceHealthy } from "../persistence/index.js";

export const TOOL_INTENT_LABEL_JOB = "tool_intent_label";
export const TOOL_INTENT_TRAIN_JOB = "tool_intent_train";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, "..", "..", "..", "tests", "fixtures", "intent", "golden-utterances.json");

/**
 * @param {Array<{ intent: string; utterance: string }>} entries
 * @param {import('@nlpjs/nlp').Nlp} nlp
 */
export function evaluateCorpus(entries, nlp) {
  if (!entries.length) return { accuracy: 0, total: 0, correct: 0, failures: [] };
  const failures = [];
  let correct = 0;
  for (const e of entries) {
    const locale = /[çğıöşü]/i.test(e.utterance) ? "tr" : "en";
    const result = nlp.process(locale, e.utterance);
    const pred = typeof result?.then === "function" ? null : result?.intent;
    if (pred === e.intent) correct++;
    else failures.push({ utterance: e.utterance, expected: e.intent, got: pred });
  }
  return { accuracy: correct / entries.length, total: entries.length, correct, failures };
}

/**
 * @param {import('@nlpjs/nlp').Nlp} nlp
 */
export async function evaluateCorpusAsync(entries, nlp) {
  if (!entries.length) return { accuracy: 0, total: 0, correct: 0, failures: [] };
  const failures = [];
  let correct = 0;
  for (const e of entries) {
    const locale = /[çğıöşü]/i.test(e.utterance) ? "tr" : "en";
    const result = await nlp.process(locale, e.utterance);
    if (result?.intent === e.intent) correct++;
    else failures.push({ utterance: e.utterance, expected: e.intent, got: result?.intent });
  }
  return { accuracy: correct / entries.length, total: entries.length, correct, failures };
}

export function loadGoldenUtterances() {
  if (!existsSync(GOLDEN_PATH)) return [];
  const data = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
  return data.utterances || [];
}

export function evaluateGoldenRegex() {
  const golden = loadGoldenUtterances();
  const failures = [];
  let correct = 0;
  for (const g of golden) {
    const r = classifyToolIntentRegex(g.utterance);
    if (r.intent === g.intent) correct++;
    else failures.push({ utterance: g.utterance, expected: g.intent, got: r.intent });
  }
  return {
    accuracy: golden.length ? correct / golden.length : 1,
    total: golden.length,
    correct,
    failures,
  };
}

/**
 * @param {import('@nlpjs/nlp').Nlp} nlp
 */
export async function evaluateGoldenNlp(nlp) {
  const golden = loadGoldenUtterances();
  return evaluateCorpusAsync(
    golden.map((g) => ({ intent: g.intent, utterance: g.utterance })),
    nlp
  );
}

async function recordModelVersion(version, corpusCount, evalReport) {
  if (!isPersistenceHealthy()) return;
  await persistenceQuery(
    `MERGE intent_model_versions AS t
     USING (SELECT @version AS version) AS s ON t.version = s.version
     WHEN MATCHED THEN UPDATE SET corpus_count = @corpusCount, eval_accuracy = @accuracy, eval_report_json = @report
     WHEN NOT MATCHED THEN INSERT (version, corpus_count, eval_accuracy, eval_report_json, promoted_by)
       VALUES (@version, @corpusCount, @accuracy, @report, 'system');`,
    {
      version,
      corpusCount,
      accuracy: evalReport.goldenNlp?.accuracy ?? evalReport.holdout?.accuracy ?? null,
      report: JSON.stringify(evalReport),
    }
  );
}

export async function runTrainJob(log = () => {}) {
  const entries = await loadActiveCorpusEntries();
  if (entries.length < 5) {
    throw new Error(`Insufficient corpus entries: ${entries.length}`);
  }

  log(`Training on ${entries.length} corpus entries`);
  const nlp = await trainNlpFromEntries(entries);

  const holdoutSize = Math.max(1, Math.floor(entries.length * 0.2));
  const holdout = entries.slice(-holdoutSize);
  const trainSet = entries.slice(0, -holdoutSize);
  const nlpHoldout = await trainNlpFromEntries(trainSet);
  const holdoutEval = await evaluateCorpusAsync(holdout, nlpHoldout);
  const goldenNlp = await evaluateGoldenNlp(nlp);
  const goldenRegex = evaluateGoldenRegex();

  const evalReport = { holdout: holdoutEval, goldenNlp, goldenRegex, corpusCount: entries.length };
  const goldenAcc = goldenNlp.accuracy;
  const passGate = goldenAcc >= 0.95 && goldenRegex.accuracy >= 0.95;

  if (!passGate) {
    const err = new Error(
      `Eval gate failed: golden NLP ${(goldenAcc * 100).toFixed(1)}%, regex ${(goldenRegex.accuracy * 100).toFixed(1)}%`
    );
    err.evalReport = evalReport;
    throw err;
  }

  const nextVersion = (getActiveModelVersion() || 0) + 1;
  saveNlpModel(nlp, nextVersion);
  await recordModelVersion(nextVersion, entries.length, evalReport);
  log(`Promoted model v${nextVersion}`);

  return { version: nextVersion, evalReport };
}

export function registerToolIntentTrainJobRunners() {
  registerJobRunner(TOOL_INTENT_LABEL_JOB, async (job, updateProgress, log) => {
    const config = getIntentTrainConfig();
    if (!config.pipelineEnabled) {
      await log("Pipeline disabled — skipping label job");
      return { skipped: true };
    }
    await log("Starting intent labeling batch");
    updateProgress(10);
    const result = await runLabelingBatch({ log: (m) => log(m) });
    updateProgress(90);
    await log(`Label batch: auto=${result.auto} llm=${result.labeled} disagreements=${result.disagreements}`);

    if (config.pipelineEnabled && result.labeled + result.auto > 0) {
      submitJob(TOOL_INTENT_TRAIN_JOB, { triggeredBy: "label_chain" });
    }
    updateProgress(100);
    return result;
  });

  registerJobRunner(TOOL_INTENT_TRAIN_JOB, async (job, updateProgress, log) => {
    const config = getIntentTrainConfig();
    if (!config.pipelineEnabled) {
      await log("Pipeline disabled — skipping train job");
      return { skipped: true };
    }
    updateProgress(5);
    await log("Training NLP model");
    try {
      const result = await runTrainJob((m) => log(m));
      reloadNlpModel();
      updateProgress(100);
      return result;
    } catch (err) {
      await log(`Train failed: ${err.message}`);
      if (err.evalReport) await log(JSON.stringify(err.evalReport.failures?.slice?.(0, 5) || []));
      throw err;
    }
  });
}

let scheduleTimer = null;

export function scheduleIntentTrainPipeline() {
  if (scheduleTimer) clearInterval(scheduleTimer);

  scheduleTimer = setInterval(async () => {
    try {
      const config = getIntentTrainConfig();
      if (!config.pipelineEnabled) return;

      const { countSamplesByStatus } = await import("./tool-intent-samples.service.js");
      const counts = await countSamplesByStatus();
      const ready = counts.confirmed + counts.pending;
      if (ready >= config.minPendingForTrain) {
        submitJob(TOOL_INTENT_LABEL_JOB, { scheduled: true });
      }
    } catch (err) {
      console.warn("[intent-train] schedule tick failed:", err.message);
    }
  }, 60 * 60 * 1000);

  scheduleTimer.unref?.();
}

export async function rollbackModelVersion(version) {
  const ok = await loadNlpModel(version);
  if (!ok) throw new Error(`Model v${version} not found`);
  return { version, rolledBack: true };
}

export async function listModelVersions() {
  if (!isPersistenceHealthy()) {
    const v = getActiveModelVersion();
    return v ? [{ version: v, corpusCount: 0, evalAccuracy: null }] : [];
  }
  const result = await persistenceQuery(
    `SELECT version, corpus_count, eval_accuracy, eval_report_json, promoted_at, promoted_by
     FROM intent_model_versions ORDER BY version DESC`
  );
  return (result?.recordset ?? []).map((r) => ({
    version: r.version,
    corpusCount: r.corpus_count,
    evalAccuracy: r.eval_accuracy,
    evalReport: r.eval_report_json ? JSON.parse(r.eval_report_json) : null,
    promotedAt: r.promoted_at,
    promotedBy: r.promoted_by,
  }));
}
