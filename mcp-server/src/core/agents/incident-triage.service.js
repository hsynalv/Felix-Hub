/**
 * Incident Triage Agent — timeline, suspected causes, postmortem draft.
 */

import { listRuns } from "../agent-runs/agent-runs.service.js";
import { listPullRequests } from "../../plugins/github/github.client.js";
import { executeRunbook } from "../ops/runbook.service.js";
import { fetchObservabilityErrorSignal } from "./observability-signal.js";

function parseRepo(repo) {
  const parts = String(repo).split("/");
  if (parts.length !== 2) throw Object.assign(new Error("repo must be owner/name"), { code: "invalid_repo" });
  return { owner: parts[0], repo: parts[1] };
}

function rankSuspectedCauses({ errorSignal, recentCommits, recentPrs, failedRuns }) {
  const causes = [];

  if (errorSignal?.spike) {
    causes.push({ rank: 1, cause: "error_spike", confidence: 0.9, detail: errorSignal.message || "Error rate spike detected" });
  }

  for (const pr of (recentPrs || []).slice(0, 5)) {
    const text = `${pr.title || ""} ${pr.body || ""}`;
    if (/hotfix|rollback|incident|fix|patch/i.test(text)) {
      causes.push({
        rank: causes.length + 1,
        cause: "recent_fix_pr",
        confidence: 0.7,
        detail: `PR #${pr.number}: ${pr.title}`,
        prNumber: pr.number,
      });
    }
  }

  for (const run of (failedRuns || []).slice(0, 3)) {
    causes.push({
      rank: causes.length + 1,
      cause: "failed_agent_run",
      confidence: 0.6,
      detail: `Run ${run.id?.slice(0, 8)}: ${run.goal}`,
      runId: run.id,
    });
  }

  for (const c of (recentCommits || []).slice(0, 3)) {
    causes.push({
      rank: causes.length + 1,
      cause: "recent_deploy",
      confidence: 0.5,
      detail: c.message || c.sha?.slice(0, 7),
      sha: c.sha,
    });
  }

  return causes
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

function buildTimeline({ errorSignal, recentCommits, recentPrs, failedRuns }) {
  const events = [];

  if (errorSignal?.detectedAt) {
    events.push({ at: errorSignal.detectedAt, type: "alert", message: errorSignal.message || "Error spike" });
  } else if (errorSignal) {
    events.push({ at: new Date().toISOString(), type: "alert", message: errorSignal.message || "Simulated error spike" });
  }

  for (const pr of recentPrs || []) {
    events.push({
      at: pr.mergedAt || pr.updatedAt,
      type: "pr_merged",
      message: `PR #${pr.number}: ${pr.title}`,
    });
  }

  for (const c of recentCommits || []) {
    events.push({
      at: c.date || c.committedAt,
      type: "commit",
      message: c.message || c.sha,
    });
  }

  for (const run of failedRuns || []) {
    events.push({
      at: run.updatedAt || run.createdAt,
      type: "failed_run",
      message: run.goal || run.id,
      runId: run.id,
    });
  }

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20);
}

function buildPostmortemDraft({ repo, timeline, suspectedCauses, owner }) {
  const lines = [
    `# Incident Postmortem — ${repo}`,
    ``,
    `**Owner:** ${owner || "TBD"}`,
    `**Generated:** ${new Date().toISOString()}`,
    ``,
    `## Timeline`,
    ``,
  ];
  for (const ev of timeline.slice(0, 10)) {
    lines.push(`- ${ev.at} — ${ev.type}: ${ev.message}`);
  }
  lines.push("", "## Suspected Causes", "");
  for (const c of suspectedCauses) {
    lines.push(`- [${Math.round(c.confidence * 100)}%] ${c.detail}`);
  }
  lines.push("", "## Action Items", "", "- [ ] Verify root cause", "- [ ] Deploy fix or rollback", "- [ ] Update monitoring", "");
  return lines.join("\n");
}

export async function triageIncident({
  repo,
  projectId = null,
  errorSignal = null,
  owner = null,
} = {}) {
  if (!repo) throw Object.assign(new Error("repo required"), { code: "invalid" });

  const observabilitySignal = await fetchObservabilityErrorSignal({ projectId });
  const signal = errorSignal || observabilitySignal || {
    spike: true,
    message: "Simulated error spike — no observability errors in window (set errorSignal or wait for audit errors)",
    detectedAt: new Date().toISOString(),
    source: "simulated_fallback",
  };

  const { owner: ghOwner, repo: ghRepo } = parseRepo(repo);
  let recentPrs = [];
  const prResult = await listPullRequests(ghOwner, ghRepo, { state: "closed", limit: 15 });
  if (prResult.ok) {
    recentPrs = (prResult.data || [])
      .filter((pr) => pr.merged_at)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        mergedAt: pr.merged_at,
        updatedAt: pr.updated_at,
        url: pr.html_url,
      }));
  }

  const runs = await listRuns({ projectId, limit: 30 });
  const failedRuns = runs.filter((r) => r.status === "failed" || r.status === "error");

  const recentCommits = failedRuns.length
    ? [{ message: "Correlated with failed agent run", sha: failedRuns[0].id?.slice(0, 7) }]
    : [];

  const suspectedCauses = rankSuspectedCauses({
    errorSignal: signal,
    recentCommits,
    recentPrs,
    failedRuns,
  });

  const timeline = buildTimeline({ errorSignal: signal, recentCommits, recentPrs, failedRuns });
  const suggestedOwner = owner || process.env.INCIDENT_DEFAULT_OWNER || "on-call";

  const recommendedActions = [
    { action: "investigate_logs", label: "Investigate observability logs", autonomy: "L1" },
    { action: "run_incident_runbook", label: "Run incident triage runbook", autonomy: "L2" },
    { action: "rollback", label: "Rollback last deploy", autonomy: "L2", requiresApproval: true },
  ];

  return {
    repo,
    projectId,
    errorSignal: signal,
    signalSource: signal.source || (errorSignal ? "explicit" : observabilitySignal ? "observability" : "simulated_fallback"),
    timeline,
    suspectedCauses,
    relatedRuns: failedRuns.slice(0, 5),
    relatedPrs: recentPrs.slice(0, 5),
    suggestedOwner,
    recommendedActions,
    postmortemDraft: buildPostmortemDraft({ repo, timeline, suspectedCauses, owner: suggestedOwner }),
    generatedAt: new Date().toISOString(),
  };
}

export async function triggerIncidentRunbook({
  repo,
  projectId,
  projectEnv = "production",
  dryRun = false,
  forceInternal = false,
} = {}) {
  return executeRunbook("rb-incident-triage", {
    parameters: { repo },
    projectId,
    projectEnv,
    createdBy: "incident-agent",
    dryRun,
    forceInternal,
  });
}
