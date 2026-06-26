/**
 * Dependency & Security Maintenance Agent.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ECOSYSTEM_MARKERS = {
  npm: "package.json",
  cargo: "Cargo.toml",
  go: "go.mod",
};

export function detectEcosystems(workspacePath = ".") {
  return Object.entries(ECOSYSTEM_MARKERS)
    .filter(([, file]) => existsSync(join(workspacePath, file)))
    .map(([name]) => name);
}

function readPackageJson(workspacePath) {
  const pkgPath = join(workspacePath, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return null;
  }
}

async function runNpmOutdated(workspacePath) {
  try {
    const { stdout } = await execFileAsync("npm", ["outdated", "--json"], {
      cwd: workspacePath,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout || "{}");
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function runNpmAudit(workspacePath) {
  try {
    const { stdout } = await execFileAsync("npm", ["audit", "--json"], {
      cwd: workspacePath,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout || "{}");
    return parsed.vulnerabilities || {};
  } catch (err) {
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        return parsed.vulnerabilities || parsed.metadata || {};
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function runGoOutdated(workspacePath) {
  try {
    const { stdout } = await execFileAsync("go", ["list", "-m", "-u", "all"], {
      cwd: workspacePath,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\S+)\s+\[(\S+)\]\s*=>\s+(\S+)/);
        if (!match) return { name: line, current: "?", latest: "?", raw: line };
        return { name: match[1], current: match[2], latest: match[3] };
      });
  } catch (err) {
    return { error: err.message, modules: [] };
  }
}

async function runCargoOutdated(workspacePath) {
  try {
    const { stdout } = await execFileAsync("cargo", ["outdated", "--format", "json"], {
      cwd: workspacePath,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout || "{}");
    const deps = parsed.dependencies || parsed;
    if (Array.isArray(deps)) {
      return deps.map((d) => ({
        name: d.name,
        current: d.project || d.compatible,
        latest: d.latest,
      }));
    }
    return [];
  } catch (err) {
    return { error: err.message, hint: "cargo outdated requires: cargo install cargo-outdated", crates: [] };
  }
}

function parseVersionParts(v) {
  const clean = String(v || "0.0.0").replace(/^[\^~>=<]*/, "");
  return clean.split(".").map((n) => parseInt(n, 10) || 0);
}

export function scoreUpdateRisk({ name, current, wanted, latest, severity = null }) {
  const cur = parseVersionParts(current);
  const want = parseVersionParts(wanted || latest || current);
  let score = 10;

  if (want[0] > cur[0]) score += 50;
  else if (want[1] > cur[1]) score += 25;
  else if (want[2] > cur[2]) score += 10;

  if (severity === "critical") score += 40;
  else if (severity === "high") score += 30;
  else if (severity === "moderate") score += 15;
  else if (severity === "low") score += 5;

  if (name === "react" || name === "next" || name === "typescript") score += 10;

  return Math.min(100, score);
}

export function buildUpdatePrBody(updates, { rollbackNote } = {}) {
  const lines = [
    "## Dependency maintenance",
    "",
    "Automated scan proposed the following updates:",
    "",
    "| Package | Current | Wanted | Risk |",
    "|---------|---------|--------|------|",
  ];
  for (const u of updates) {
    lines.push(`| ${u.name} | ${u.current} | ${u.wanted || u.latest} | ${u.riskScore} |`);
  }
  lines.push("", "### Rollback", rollbackNote || "Revert this PR and run `npm ci`.");
  return lines.join("\n");
}

export async function scanDependencies({
  workspacePath = ".",
  ecosystem = "npm",
  maxRiskScore = 70,
} = {}) {
  const detected = detectEcosystems(workspacePath);
  const pkg = readPackageJson(workspacePath);
  const outdated = ecosystem === "npm" ? await runNpmOutdated(workspacePath) : {};
  const audit = ecosystem === "npm" ? await runNpmAudit(workspacePath) : {};

  if (ecosystem === "go" && detected.includes("go")) {
    const modules = await runGoOutdated(workspacePath);
    const list = Array.isArray(modules) ? modules : modules.modules || [];
    const updates = list.map((m) => {
      const riskScore = scoreUpdateRisk({ name: m.name, current: m.current, wanted: m.latest, latest: m.latest });
      return {
        name: m.name,
        current: m.current,
        wanted: m.latest,
        latest: m.latest,
        riskScore,
        safe: riskScore <= maxRiskScore,
        requiresApproval: riskScore > maxRiskScore,
      };
    });
    return {
      workspacePath,
      ecosystem: "go",
      packageFound: existsSync(join(workspacePath, "go.mod")),
      detectedEcosystems: detected,
      outdatedCount: updates.length,
      vulnerabilityCount: 0,
      safeUpdates: updates.filter((u) => u.safe),
      highRisk: updates.filter((u) => u.requiresApproval),
      updates,
      maxRiskScore,
      requiresApproval: updates.some((u) => u.requiresApproval),
      scanNote: Array.isArray(modules) ? null : modules.error,
      generatedAt: new Date().toISOString(),
    };
  }

  if (ecosystem === "cargo" && detected.includes("cargo")) {
    const crates = await runCargoOutdated(workspacePath);
    const list = Array.isArray(crates) ? crates : crates.crates || [];
    const updates = list.map((c) => {
      const riskScore = scoreUpdateRisk({ name: c.name, current: c.current, wanted: c.latest, latest: c.latest });
      return {
        name: c.name,
        current: c.current,
        wanted: c.latest,
        latest: c.latest,
        riskScore,
        safe: riskScore <= maxRiskScore,
        requiresApproval: riskScore > maxRiskScore,
      };
    });
    return {
      workspacePath,
      ecosystem: "cargo",
      packageFound: existsSync(join(workspacePath, "Cargo.toml")),
      detectedEcosystems: detected,
      outdatedCount: updates.length,
      vulnerabilityCount: 0,
      safeUpdates: updates.filter((u) => u.safe),
      highRisk: updates.filter((u) => u.requiresApproval),
      updates,
      maxRiskScore,
      requiresApproval: updates.some((u) => u.requiresApproval),
      scanNote: Array.isArray(crates) ? null : crates.error || crates.hint,
      generatedAt: new Date().toISOString(),
    };
  }

  if (ecosystem !== "npm" && detected.includes(ecosystem)) {
    return {
      workspacePath,
      ecosystem,
      packageFound: true,
      detectedEcosystems: detected,
      outdatedCount: 0,
      vulnerabilityCount: 0,
      safeUpdates: [],
      highRisk: [],
      updates: [],
      maxRiskScore,
      requiresApproval: false,
      unsupportedEcosystemScan: true,
      message: `${ecosystem} marker detected but scan failed — try ecosystem=go or cargo explicitly`,
      generatedAt: new Date().toISOString(),
    };
  }

  const vulnByName = {};
  for (const [name, info] of Object.entries(audit)) {
    if (info && typeof info === "object" && info.severity) {
      vulnByName[name] = info.severity;
    }
  }

  const updates = [];
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  for (const [name, spec] of Object.entries(deps)) {
    const out = outdated[name];
    const current = out?.current || spec;
    const wanted = out?.wanted || out?.latest;
    const latest = out?.latest;
    const severity = vulnByName[name] || null;
    const riskScore = scoreUpdateRisk({ name, current, wanted, latest, severity });
    updates.push({
      name,
      current,
      wanted,
      latest,
      severity,
      riskScore,
      safe: riskScore <= maxRiskScore,
      requiresApproval: riskScore > maxRiskScore,
    });
  }

  for (const [name, out] of Object.entries(outdated)) {
    if (updates.some((u) => u.name === name)) continue;
    const riskScore = scoreUpdateRisk({
      name,
      current: out.current,
      wanted: out.wanted,
      latest: out.latest,
      severity: vulnByName[name],
    });
    updates.push({
      name,
      current: out.current,
      wanted: out.wanted,
      latest: out.latest,
      severity: vulnByName[name] || null,
      riskScore,
      safe: riskScore <= maxRiskScore,
      requiresApproval: riskScore > maxRiskScore,
    });
  }

  updates.sort((a, b) => b.riskScore - a.riskScore);

  const safeUpdates = updates.filter((u) => u.safe);
  const highRisk = updates.filter((u) => u.requiresApproval);

  return {
    workspacePath,
    ecosystem,
    packageFound: !!pkg,
    detectedEcosystems: detected,
    outdatedCount: updates.length,
    vulnerabilityCount: Object.keys(vulnByName).length,
    safeUpdates,
    highRisk,
    updates,
    maxRiskScore,
    requiresApproval: highRisk.length > 0,
    generatedAt: new Date().toISOString(),
  };
}

export function proposeMaintenancePr(scan, { repo, branch = "deps/maintenance" } = {}) {
  const targets = scan.safeUpdates.length ? scan.safeUpdates : scan.updates.slice(0, 3);
  const body = buildUpdatePrBody(targets, {
    rollbackNote: "Revert merge commit and run tests. Pin previous lockfile if needed.",
  });

  return {
    repo,
    title: `chore(deps): maintenance updates (${targets.length} packages)`,
    head: branch,
    base: "main",
    body,
    packages: targets.map((t) => t.name),
    requiresApproval: scan.requiresApproval,
    highRiskPackages: scan.highRisk.map((h) => h.name),
  };
}
