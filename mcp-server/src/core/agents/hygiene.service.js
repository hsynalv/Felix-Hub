/**
 * Workspace Hygiene Agent — stale PRs, branches, TODOs, failed runs.
 */

import { listPullRequests } from "../../plugins/github/github.client.js";
import { listRuns } from "../agent-runs/agent-runs.service.js";
import { getLogs } from "../audit/index.js";
import { getEnvValue } from "../settings/effective-config.js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, extname } from "path";

const CODE_EXT = new Set([".js", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".md"]);

function parseRepo(repo) {
  const parts = String(repo).split("/");
  if (parts.length !== 2) throw Object.assign(new Error("repo must be owner/name"), { code: "invalid_repo" });
  return { owner: parts[0], repo: parts[1] };
}

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return (Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000);
}

function scanTodosInDir(dir, { limit = 50, maxDepth = 4, depth = 0 } = {}) {
  const hits = [];
  if (depth > maxDepth || !existsSync(dir)) return hits;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return hits;
  }

  for (const ent of entries) {
    if (hits.length >= limit) break;
    if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "dist") continue;

    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      hits.push(...scanTodosInDir(full, { limit: limit - hits.length, maxDepth, depth: depth + 1 }));
    } else if (CODE_EXT.has(extname(ent.name))) {
      try {
        const content = readFileSync(full, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, i) => {
          if (hits.length >= limit) return;
          if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
            hits.push({ file: full, line: i + 1, text: line.trim().slice(0, 120) });
          }
        });
      } catch {
        /* skip binary */
      }
    }
  }
  return hits;
}

export async function fetchStalePrs(repo, { stalePrDays = 30, limit = 50 } = {}) {
  const { owner, repo: repoName } = parseRepo(repo);
  const result = await listPullRequests(owner, repoName, { state: "open", limit });
  if (!result.ok) return { ok: false, error: result.error, stale: [] };

  const stale = (result.data || [])
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      updatedAt: pr.updated_at,
      daysOpen: Math.floor(daysSince(pr.created_at)),
      daysSinceUpdate: Math.floor(daysSince(pr.updated_at)),
    }))
    .filter((pr) => pr.daysSinceUpdate >= stalePrDays);

  return { ok: true, stale, thresholdDays: stalePrDays };
}

export async function listStaleFailedRuns(projectId, { archiveRunDays = 90, limit = 100 } = {}) {
  const runs = await listRuns({ status: "failed", projectId, limit });
  const stale = runs
    .filter((r) => daysSince(r.updatedAt) >= archiveRunDays)
    .map((r) => ({
      id: r.id,
      goal: r.goal,
      updatedAt: r.updatedAt,
      daysOld: Math.floor(daysSince(r.updatedAt)),
      templateId: r.metadata?.templateId || null,
    }));
  return { stale, thresholdDays: archiveRunDays, archiveCandidates: stale.length };
}

export function suggestBranchCleanup(branches = []) {
  const stalePatterns = [/^(feature|fix|chore|deps)\//i, /^release\//i];
  return branches
    .filter((b) => b !== "main" && b !== "master" && b !== "develop")
    .filter((b) => stalePatterns.some((re) => re.test(b)))
    .map((b) => ({
      branch: b,
      reason: "matches stale branch naming pattern",
      requiresApproval: true,
      action: "delete_branch",
    }));
}

const INTEGRATION_KEY_PREFIXES = {
  GITHUB_TOKEN: "github_",
  NOTION_API_KEY: "notion_",
  N8N_API_KEY: "n8n_",
  TELEGRAM_BOT_TOKEN: "notifications_",
  OPENAI_API_KEY: "llm_",
};

const INTEGRATION_KEYS = Object.keys(INTEGRATION_KEY_PREFIXES);

export async function detectUnusedIntegrationSecrets({ auditLimit = 300 } = {}) {
  const configured = [];
  const unused = [];
  const logs = await getLogs({ limit: auditLimit });
  const logList = Array.isArray(logs) ? logs : logs?.logs || [];

  for (const key of INTEGRATION_KEYS) {
    const value = getEnvValue(key) || process.env[key];
    if (!value) continue;
    configured.push(key);
    const prefix = INTEGRATION_KEY_PREFIXES[key];
    const used = logList.some((entry) => {
      const tool = entry.toolName || entry.operation || entry.path || "";
      const plugin = entry.plugin || "";
      return (
        (typeof tool === "string" && tool.startsWith(prefix)) ||
        (typeof plugin === "string" && plugin.toLowerCase().includes(prefix.replace(/_$/, "")))
      );
    });
    if (!used) {
      unused.push({
        key,
        reason: "no_matching_tool_calls_in_recent_audit",
        heuristic: true,
      });
    }
  }

  return { configured, unused, auditSampleSize: logList.length };
}

export async function detectKnowledgeDrift({ projectId = null } = {}) {
  const drift = { notion: null, obsidian: null, projectId };

  const notionKey = getEnvValue("NOTION_API_KEY") || process.env.NOTION_API_KEY;
  if (notionKey) {
    try {
      const { notionRequest } = await import("../../plugins/notion/notion.client.js");
      const search = await notionRequest("POST", "/search", { page_size: 3 });
      const remoteCount = search?.results?.length ?? 0;
      drift.notion = {
        status: remoteCount > 0 ? "ok" : "empty_or_unreachable",
        remoteSampleCount: remoteCount,
        message:
          remoteCount > 0
            ? "Notion API reachable — compare project notes manually for drift"
            : "Notion API returned no results; check token or workspace access",
      };
    } catch (err) {
      drift.notion = {
        status: "drift_suspected",
        message: `Notion API error while checking drift: ${err.message}`,
      };
    }
  } else {
    drift.notion = { status: "not_configured" };
  }

  const obsidianPaths = [
    process.env.OBSIDIAN_VAULT_PATH,
    join(process.cwd(), "vault"),
    join(process.cwd(), "obsidian"),
  ].filter(Boolean);

  const existingVault = obsidianPaths.find((p) => existsSync(p));
  if (existingVault) {
    let mdCount = 0;
    try {
      const entries = readdirSync(existingVault, { withFileTypes: true });
      mdCount = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
    } catch {
      mdCount = 0;
    }
    drift.obsidian = {
      status: mdCount > 0 ? "vault_detected" : "vault_empty",
      vaultPath: existingVault,
      markdownFilesAtRoot: mdCount,
      message:
        mdCount > 0
          ? "Local vault present — run obsidian_vault_search to compare with brain memories"
          : "Vault path exists but no markdown at root",
    };
  } else {
    drift.obsidian = {
      status: "not_configured",
      message: "Set OBSIDIAN_VAULT_PATH or add ./vault for drift checks",
    };
  }

  return drift;
}

export async function runHygieneScan({
  repo,
  projectId = null,
  workspacePath = ".",
  stalePrDays = 30,
  archiveRunDays = 90,
  branches = [],
} = {}) {
  if (!repo) throw Object.assign(new Error("repo required"), { code: "invalid" });

  const [stalePrs, failedRuns, todos, secrets, drift] = await Promise.all([
    fetchStalePrs(repo, { stalePrDays }),
    listStaleFailedRuns(projectId, { archiveRunDays }),
    Promise.resolve(scanTodosInDir(workspacePath, { limit: 40 })),
    detectUnusedIntegrationSecrets(),
    detectKnowledgeDrift({ projectId }),
  ]);

  const branchCandidates = suggestBranchCleanup(branches);

  const summary = {
    stalePrCount: stalePrs.stale?.length || 0,
    todoCount: todos.length,
    failedRunArchiveCount: failedRuns.archiveCandidates,
    branchCleanupCount: branchCandidates.length,
    unusedSecretsCount: secrets.unused.length,
    knowledgeDriftAlerts: [drift.notion, drift.obsidian].filter((d) => d?.status === "drift_suspected").length,
  };

  const destructiveActions = [
    ...branchCandidates,
    ...(stalePrs.stale || []).map((pr) => ({
      type: "close_pr",
      prNumber: pr.number,
      title: pr.title,
      requiresApproval: true,
      reason: `stale > ${stalePrDays} days`,
    })),
  ];

  return {
    repo,
    projectId,
    generatedAt: new Date().toISOString(),
    summary,
    stalePrs: stalePrs.stale || [],
    todos: todos.slice(0, 30),
    failedRuns: failedRuns.stale,
    branchCandidates,
    destructiveActions,
    requiresApproval: destructiveActions.length > 0,
    unusedSecrets: secrets,
    knowledgeDrift: drift,
    reportMarkdown: buildHygieneReportMarkdown({
      repo,
      summary,
      stalePrs: stalePrs.stale,
      todos,
      failedRuns: failedRuns.stale,
      branchCandidates,
      secrets,
      drift,
    }),
  };
}

function buildHygieneReportMarkdown({
  repo,
  summary,
  stalePrs,
  todos,
  failedRuns,
  branchCandidates,
  secrets,
  drift,
}) {
  const lines = [
    `# Hygiene Report — ${repo}`,
    ``,
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Stale PRs | ${summary.stalePrCount} |`,
    `| TODO/FIXME | ${summary.todoCount} |`,
    `| Failed runs to archive | ${summary.failedRunArchiveCount} |`,
    `| Branch cleanup candidates | ${summary.branchCleanupCount} |`,
    `| Unused integration secrets (heuristic) | ${summary.unusedSecretsCount} |`,
    `| Knowledge drift alerts | ${summary.knowledgeDriftAlerts} |`,
    ``,
  ];

  if (stalePrs?.length) {
    lines.push(`## Stale PRs`, "");
    for (const pr of stalePrs.slice(0, 10)) {
      lines.push(`- #${pr.number} ${pr.title} (${pr.daysSinceUpdate}d since update)`);
    }
    lines.push("");
  }

  if (branchCandidates?.length) {
    lines.push(`## Branch cleanup (approval required)`, "");
    for (const b of branchCandidates.slice(0, 10)) {
      lines.push(`- \`${b.branch}\` — ${b.reason}`);
    }
    lines.push("");
  }

  if (failedRuns?.length) {
    lines.push(`## Failed runs archive candidates`, "");
    for (const r of failedRuns.slice(0, 5)) {
      lines.push(`- ${r.id.slice(0, 8)} — ${r.goal} (${r.daysOld}d old)`);
    }
    lines.push("");
  }

  if (secrets?.unused?.length) {
    lines.push(`## Unused secrets (heuristic)`, "");
    for (const s of secrets.unused) {
      lines.push(`- \`${s.key}\` — ${s.reason}`);
    }
    lines.push("");
  }

  if (drift?.notion?.status === "drift_suspected" || drift?.obsidian?.status === "drift_suspected") {
    lines.push(`## Knowledge drift`, "");
    if (drift.notion?.message) lines.push(`- Notion: ${drift.notion.message}`);
    if (drift.obsidian?.message) lines.push(`- Obsidian: ${drift.obsidian.message}`);
    lines.push("");
  }

  return lines.join("\n");
}
