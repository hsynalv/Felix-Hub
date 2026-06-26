/**
 * Optional RAG enrichment for project goal search (Faz 4 foundation).
 */

import { callTool } from "../tool-registry.js";

/**
 * @param {string} projectKey
 * @param {string} goal
 * @param {number} limit
 */
export async function searchProjectRagSnippets(projectKey, goal, limit = 5) {
  const workspaceId = `project-${projectKey}`;
  try {
    const result = await callTool(
      "rag_search",
      { query: goal, limit, minScore: 0.15 },
      { workspaceId, user: "system", scopes: ["read"] }
    );
    if (!result?.ok) return [];
    return (result.data?.results || []).map((r) => ({
      type: "rag",
      score: r.score ?? 0.5,
      text: (r.content || r.snippet || "").slice(0, 200),
      id: r.id,
    }));
  } catch {
    return [];
  }
}

/**
 * Merge keyword snippets with RAG hits (dedupe by id/text).
 */
export function mergeProjectSnippets(keywordSnippets = [], ragSnippets = []) {
  const seen = new Set();
  const merged = [];
  for (const s of [...ragSnippets, ...keywordSnippets]) {
    const key = s.id || s.text;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged.sort((a, b) => (b.score || 0) - (a.score || 0));
}
