/**
 * Shared recall logic for MCP tool + REST POST /brain/recall
 */

import { callTool as useTool } from "../../core/tool-registry.js";
import { listMemories, recallScore } from "./brain.memory.js";

/**
 * @param {object} args
 * @param {string} args.query
 * @param {string} [args.type]
 * @param {string} [args.projectId]
 * @param {string[]} [args.tags]
 * @param {number} [args.limit]
 * @param {number} [args.minScore]
 */
export async function runRecall(args) {
  const limit = Math.min(args.limit || 10, 50);

  const ragResult = await useTool(
    "rag_search",
    {
      query: args.query,
      limit: limit * 2,
      minScore: args.minScore ?? 0.1,
    },
    { workspaceId: "brain-memories" }
  );

  const semanticMap = new Map();
  if (ragResult.ok) {
    for (const r of ragResult.data?.results || []) {
      semanticMap.set(r.id, r.score);
    }
  }

  const filtered = await listMemories({
    type: args.type || undefined,
    projectId: args.projectId || undefined,
    tags: args.tags || undefined,
    limit: limit * 4,
  });

  const ranked = filtered
    .map((m) => ({
      ...m,
      _score: recallScore(semanticMap.get(m.id) || 0, m.importance, m.createdAt),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...m }) => ({ ...m, score: _score }));

  return {
    query: args.query,
    total: ranked.length,
    semanticHits: semanticMap.size,
    memories: ranked,
  };
}
