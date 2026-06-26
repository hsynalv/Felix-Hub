/**
 * Release Manager Agent — changelog, semver, migration risk, draft release.
 */

import { listPullRequests, listReleases, createRelease, getLatestRelease } from "../../plugins/github/github.client.js";

const CONVENTIONAL = {
  feat: "Added",
  fix: "Fixed",
  docs: "Changed",
  chore: "Changed",
  refactor: "Changed",
  perf: "Changed",
  test: "Changed",
  build: "Changed",
  ci: "Changed",
  security: "Security",
};

function parseRepo(repo) {
  const parts = String(repo).split("/");
  if (parts.length !== 2) throw Object.assign(new Error("repo must be owner/name"), { code: "invalid_repo" });
  return { owner: parts[0], repo: parts[1] };
}

function classifyPr(title = "") {
  const match = title.match(/^(\w+)(!?|\([^)]+\))?!?:\s*/);
  if (!match) return { type: "Changed", breaking: false };
  const kind = match[1];
  const breaking = title.includes("!:") || title.includes("BREAKING");
  return { type: CONVENTIONAL[kind] || "Changed", breaking };
}

function groupPrsByArea(prs) {
  const groups = {};
  for (const pr of prs) {
    const area = pr.labels?.[0] || pr.area || "general";
    if (!groups[area]) groups[area] = [];
    groups[area].push(pr);
  }
  return groups;
}

export function suggestSemver(prs, currentVersion = "0.0.0") {
  let bump = "patch";
  for (const pr of prs) {
    const { breaking, type } = classifyPr(pr.title || "");
    if (breaking) return { bump: "major", suggested: bumpVersion(currentVersion, "major"), reason: "breaking change detected" };
    if (type === "Added") bump = bump === "patch" ? "minor" : bump;
  }
  return { bump, suggested: bumpVersion(currentVersion, bump), reason: `${bump} bump from conventional commits` };
}

function bumpVersion(version, bump) {
  const parts = String(version).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (bump === "major") return `v${parts[0] + 1}.0.0`;
  if (bump === "minor") return `v${parts[0]}.${parts[1] + 1}.0`;
  return `v${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

export function buildChangelog(prs, { format = "keep-a-changelog", sinceTag = "v0.0.0" } = {}) {
  const sections = { Added: [], Changed: [], Fixed: [], Security: [], Removed: [], Deprecated: [] };
  for (const pr of prs) {
    const { type } = classifyPr(pr.title || "");
    const line = `- ${pr.title} (#${pr.number})`;
    if (sections[type]) sections[type].push(line);
    else sections.Changed.push(line);
  }

  if (format === "conventional") {
    return prs.map((pr) => `- ${pr.title} (#${pr.number})`).join("\n");
  }

  const blocks = [`## [Unreleased] — since ${sinceTag}`, ""];
  for (const [heading, lines] of Object.entries(sections)) {
    if (!lines.length) continue;
    blocks.push(`### ${heading}`, ...lines, "");
  }
  return blocks.join("\n").trim();
}

export function scanMigrationRisks(prs) {
  const risks = [];
  const patterns = [
    { re: /migration|schema|database|sql/i, level: "high", kind: "database" },
    { re: /breaking|BREAKING|api change/i, level: "high", kind: "breaking-api" },
    { re: /rename|remove|delete endpoint/i, level: "medium", kind: "api-surface" },
    { re: /config|env|secret/i, level: "medium", kind: "configuration" },
  ];

  for (const pr of prs) {
    const text = `${pr.title || ""} ${pr.body || ""}`;
    for (const p of patterns) {
      if (p.re.test(text)) {
        risks.push({
          prNumber: pr.number,
          title: pr.title,
          level: p.level,
          kind: p.kind,
          message: `${p.kind} risk in PR #${pr.number}`,
        });
      }
    }
  }
  return risks;
}

export function buildTestChecklist({ migrationRisks = [], semver = {} } = {}) {
  const items = [
    "Run full unit test suite",
    "Run integration tests on staging",
    "Verify changelog accuracy",
    "Confirm semver bump: " + (semver.suggested || "TBD"),
  ];
  if (migrationRisks.some((r) => r.level === "high")) {
    items.push("Run database migration dry-run on staging");
    items.push("Verify rollback migration exists");
  }
  items.push("Smoke test critical user paths");
  return items;
}

export function buildRollbackNote({ sinceTag, suggestedTag, migrationRisks = [] } = {}) {
  const lines = [
    `# Rollback plan`,
    ``,
    `If release ${suggestedTag || "TBD"} fails:`,
    `1. Revert release branch merge or redeploy previous tag ${sinceTag}`,
    `2. Run health checks and monitor error rates for 30 minutes`,
  ];
  if (migrationRisks.length) {
    lines.push(`3. Execute rollback migration if DB changes were applied`);
    lines.push(`4. Migration risks: ${migrationRisks.map((r) => r.kind).join(", ")}`);
  }
  lines.push(`5. Document incident and link failed release run`);
  return lines.join("\n");
}

function normalizePr(pr) {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    mergedAt: pr.merged_at,
    updatedAt: pr.updated_at,
    labels: (pr.labels || []).map((l) => l.name || l),
    url: pr.html_url,
  };
}

export async function fetchMergedPrsSinceTag(repo, sinceTag, { limit = 50 } = {}) {
  const { owner, repo: repoName } = parseRepo(repo);
  const result = await listPullRequests(owner, repoName, { state: "closed", limit });
  if (!result.ok) return { ok: false, error: result.error, prs: [] };

  let sinceDate = null;
  if (sinceTag && sinceTag !== "v0.0.0") {
    const releases = await listReleases(owner, repoName, { limit: 20 });
    if (releases.ok) {
      const match = releases.data.find((r) => r.tag_name === sinceTag);
      sinceDate = match?.published_at ? new Date(match.published_at) : null;
    }
  }

  const prs = (result.data || [])
    .filter((pr) => pr.merged_at)
    .map(normalizePr)
    .filter((pr) => !sinceDate || new Date(pr.mergedAt) > sinceDate);

  return { ok: true, prs, sinceTag, sinceDate: sinceDate?.toISOString() || null };
}

export async function analyzeRelease({
  repo,
  sinceTag = "v0.0.0",
  changelogFormat = "keep-a-changelog",
  prs: inputPrs = null,
} = {}) {
  if (!repo) throw Object.assign(new Error("repo required"), { code: "invalid" });

  let prs = inputPrs;
  let fetchMeta = null;
  if (!prs) {
    const fetched = await fetchMergedPrsSinceTag(repo, sinceTag);
    fetchMeta = fetched;
    prs = fetched.prs || [];
  }

  const grouped = groupPrsByArea(prs);
  let currentVersion = sinceTag && sinceTag !== "v0.0.0" ? sinceTag : "v0.0.0";
  if (process.env.GITHUB_TOKEN && !inputPrs) {
    try {
      const { owner, repo: repoName } = parseRepo(repo);
      const latest = await getLatestRelease(owner, repoName);
      if (latest.ok && latest.data?.tag_name) {
        currentVersion = latest.data.tag_name;
      }
    } catch {
      /* optional */
    }
  }

  const semver = suggestSemver(prs, currentVersion);
  const changelog = buildChangelog(prs, { format: changelogFormat, sinceTag });
  const migrationRisks = scanMigrationRisks(prs);
  const testChecklist = buildTestChecklist({ migrationRisks, semver });
  const rollbackNote = buildRollbackNote({ sinceTag, suggestedTag: semver.suggested, migrationRisks });

  return {
    repo,
    sinceTag,
    prCount: prs.length,
    grouped,
    changelog,
    semver,
    migrationRisks,
    testChecklist,
    rollbackNote,
    requiresApproval: true,
    fetchMeta,
    generatedAt: new Date().toISOString(),
  };
}

export async function createDraftGitHubRelease({
  repo,
  tagName,
  name,
  body,
  targetCommitish = "main",
  draft = true,
} = {}) {
  const { owner, repo: repoName } = parseRepo(repo);
  if (!tagName) throw Object.assign(new Error("tagName required"), { code: "invalid" });

  const result = await createRelease(owner, repoName, {
    tag_name: tagName,
    name: name || tagName,
    body: body || "",
    draft: !!draft,
    target_commitish: targetCommitish,
    generate_release_notes: false,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, details: result.details };
  }

  return {
    ok: true,
    release: {
      id: result.data.id,
      tagName: result.data.tag_name,
      url: result.data.html_url,
      draft: result.data.draft,
    },
  };
}
