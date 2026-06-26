/**
 * Knowledge conflict detection and resolution (V6.11).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { detectKnowledgeDrift } from "../agents/hygiene.service.js";
import { listStoredConflicts, saveConflict, resolveConflict } from "./conflict-store.js";
import { emitInboxUpdate } from "../inbox/inbox-events.js";

const AUTH_PATTERNS = [
  { id: "jwt", re: /\bjwt\b|json web token|bearer token/i },
  { id: "api_key", re: /\bapi[_\s-]?key\b|x-api-key|apikey/i },
  { id: "session", re: /\bsession\b.*\bcookie\b|\bcookie\b.*\bsession\b/i },
  { id: "oauth", re: /\boauth\b|openid/i },
];

function extractSnippet(text, topic, maxLen = 200) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(topic.toLowerCase());
  if (idx < 0) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  return text.slice(start, start + maxLen).trim();
}

function detectAuthStance(text) {
  const stances = [];
  for (const p of AUTH_PATTERNS) {
    if (p.re.test(text)) stances.push(p.id);
  }
  return stances;
}

function gatherSources({ topic, workspacePath = "." }) {
  const sources = [];

  const readmePath = join(workspacePath, "README.md");
  if (existsSync(readmePath)) {
    try {
      const content = readFileSync(readmePath, "utf8");
      if (content.toLowerCase().includes(topic.toLowerCase()) || detectAuthStance(content).length) {
        sources.push({
          source: "readme",
          path: readmePath,
          snippet: extractSnippet(content, topic),
          stances: detectAuthStance(content),
          confidence: 0.75,
          updatedAt: null,
        });
      }
    } catch {
      /* skip */
    }
  }

  const envExample = join(workspacePath, ".env.example");
  if (existsSync(envExample)) {
    try {
      const content = readFileSync(envExample, "utf8");
      sources.push({
        source: "env_example",
        path: envExample,
        snippet: extractSnippet(content, topic),
        stances: detectAuthStance(content),
        confidence: 0.65,
        updatedAt: null,
      });
    } catch {
      /* skip */
    }
  }

  return sources;
}

function findConflicts(topic, sources) {
  const conflicts = [];
  const stanceMap = new Map();

  for (const src of sources) {
    for (const stance of src.stances) {
      if (!stanceMap.has(stance)) stanceMap.set(stance, []);
      stanceMap.get(stance).push(src);
    }
  }

  const stances = [...stanceMap.keys()];
  if (stances.length >= 2) {
    conflicts.push({
      topic,
      type: "auth_method_mismatch",
      message: `Kaynaklar farklı auth yaklaşımları öne sürüyor: ${stances.join(" vs ")}`,
      sources: sources.map((s) => ({
        source: s.source,
        snippet: s.snippet,
        stances: s.stances,
        confidence: s.confidence,
      })),
      suggestedResolution: "README veya project pin ile tek kaynak seçin",
    });
  }

  if (!conflicts.length && sources.length >= 2) {
    const uniqueSnippets = new Set(sources.map((s) => s.snippet.slice(0, 80)));
    if (uniqueSnippets.size >= 2) {
      conflicts.push({
        topic,
        type: "content_divergence",
        message: "Aynı konu için farklı ifadeler bulundu",
        sources: sources.map((s) => ({
          source: s.source,
          snippet: s.snippet,
          confidence: s.confidence,
        })),
        suggestedResolution: "Kaynaklardan birini pin'leyin",
      });
    }
  }

  return conflicts;
}

export async function detectConflicts({ topic, projectId = null, workspacePath = "." } = {}) {
  if (!topic) {
    throw Object.assign(new Error("topic required"), { code: "invalid" });
  }

  const sources = gatherSources({ topic, workspacePath });
  const drift = await detectKnowledgeDrift({ projectId });

  if (drift.notion?.status === "ok") {
    sources.push({
      source: "notion",
      snippet: drift.notion.message,
      stances: detectAuthStance(drift.notion.message || ""),
      confidence: 0.5,
    });
  }
  if (drift.obsidian?.vaultPath) {
    sources.push({
      source: "obsidian",
      snippet: drift.obsidian.message,
      stances: [],
      confidence: 0.5,
    });
  }

  const conflicts = findConflicts(topic, sources);
  const stored = conflicts.map((c) =>
    saveConflict({
      ...c,
      projectId,
      status: "open",
    })
  );

  if (stored.length) {
    emitInboxUpdate({ type: "conflict_detected", count: stored.length, topic });
  }

  return {
    topic,
    projectId,
    sources,
    drift,
    conflicts: stored,
    count: stored.length,
  };
}

export { listStoredConflicts, resolveConflict };

export function getConflictReport(conflictId) {
  return listStoredConflicts().find((c) => c.id === conflictId) || null;
}
