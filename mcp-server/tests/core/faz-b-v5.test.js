/**
 * V5 Faz B — Release Manager, Maintenance, Hygiene agents.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import supertest from "supertest";

vi.mock("../../src/core/config.js", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    config: {
      ...mod.config,
      persistence: { ...mod.config.persistence, enabled: false },
      redis: { ...mod.config.redis, enabled: false, url: undefined },
    },
  };
});

vi.mock("../../src/plugins/github/github.client.js", () => ({
  listPullRequests: vi.fn(async () => ({ ok: true, data: [] })),
  listReleases: vi.fn(async () => ({ ok: true, data: [] })),
  createRelease: vi.fn(async () => ({ ok: true, data: { id: 1, tag_name: "v1.0.0", html_url: "https://github.com/a/r/releases/1", draft: true } })),
  getLatestRelease: vi.fn(async () => ({ ok: true, data: { tag_name: "v1.0.0" } })),
}));

import { getIntegrationServer } from "../framework/test-server.js";
import { analyzeRelease, suggestSemver, buildChangelog, scanMigrationRisks } from "../../src/core/agents/release-manager.service.js";
import { scanDependencies, scoreUpdateRisk, proposeMaintenancePr } from "../../src/core/agents/maintenance.service.js";
import { runHygieneScan, suggestBranchCleanup } from "../../src/core/agents/hygiene.service.js";
import { listAgentPresets } from "../../src/core/agents/agent-presets.js";
import { listRunbooks } from "../../src/core/ops/runbook-store.js";
import { getWorkflowTemplate } from "../../src/core/agent-runs/workflow-templates.js";

const WRITE_KEY = "faz-b-v5-write-key-32-chars!!";
const READ_KEY = "faz-b-v5-read-key---32-chars!!";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "faz-b-test")
    .set("x-env", "staging");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "faz-b-test")
    .set("x-env", "staging");
}

const SAMPLE_PRS = [
  { number: 10, title: "feat: add OAuth login", body: "" },
  { number: 11, title: "fix: resolve timeout", body: "" },
  { number: 12, title: "feat!: breaking API migration", body: "database schema migration required" },
];

describe("V5 Faz B", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    delete process.env.GITHUB_TOKEN;
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("workflow templates exist for faz B agents", () => {
    expect(getWorkflowTemplate("release-manager")).toBeTruthy();
    expect(getWorkflowTemplate("dependency-maintenance")).toBeTruthy();
    expect(getWorkflowTemplate("workspace-hygiene")).toBeTruthy();
  });

  it("builtin runbooks include faz B presets", () => {
    const ids = listRunbooks().map((r) => r.id);
    expect(ids).toContain("rb-release-manager");
    expect(ids).toContain("rb-maintenance");
    expect(ids).toContain("rb-hygiene");
  });

  it("analyzeRelease produces changelog and semver from PRs", async () => {
    const result = await analyzeRelease({
      repo: "acme/app",
      sinceTag: "v1.0.0",
      prs: SAMPLE_PRS,
    });
    expect(result.prCount).toBe(3);
    expect(result.changelog).toContain("OAuth login");
    expect(result.semver.bump).toBe("major");
    expect(result.migrationRisks.length).toBeGreaterThan(0);
    expect(result.testChecklist.length).toBeGreaterThan(2);
    expect(result.rollbackNote).toContain("Rollback");
  }, 15000);

  it("suggestSemver bumps minor for feat-only PRs", () => {
    const semver = suggestSemver([{ title: "feat: x" }, { title: "fix: y" }], "v1.2.3");
    expect(semver.bump).toBe("minor");
    expect(semver.suggested).toBe("v1.3.0");
  });

  it("scanMigrationRisks detects database changes", () => {
    const risks = scanMigrationRisks(SAMPLE_PRS);
    expect(risks.some((r) => r.kind === "database" || r.kind === "breaking-api")).toBe(true);
  });

  it("scoreUpdateRisk flags major version bumps as high risk", () => {
    const score = scoreUpdateRisk({ name: "lodash", current: "3.0.0", wanted: "4.0.0", severity: "high" });
    expect(score).toBeGreaterThan(70);
  });

  it("scanDependencies reads package.json in workspace", async () => {
    const scan = await scanDependencies({ workspacePath: process.cwd(), maxRiskScore: 70 });
    expect(scan.packageFound).toBe(true);
    expect(scan.updates).toBeDefined();
  });

  it("proposeMaintenancePr marks high risk updates", async () => {
    const scan = {
      safeUpdates: [{ name: "debug", current: "1.0.0", wanted: "1.0.1", riskScore: 15 }],
      highRisk: [{ name: "react", current: "17.0.0", wanted: "19.0.0", riskScore: 85, requiresApproval: true }],
      requiresApproval: true,
      updates: [],
    };
    const proposal = proposeMaintenancePr(scan, { repo: "acme/app" });
    expect(proposal.requiresApproval).toBe(true);
    expect(proposal.body).toContain("debug");
  });

  it("suggestBranchCleanup requires approval for feature branches", () => {
    const candidates = suggestBranchCleanup(["main", "feature/old-work", "develop"]);
    expect(candidates.length).toBe(1);
    expect(candidates[0].requiresApproval).toBe(true);
  });

  it("runHygieneScan returns report with branch candidates", async () => {
    const report = await runHygieneScan({
      repo: "acme/app",
      projectId: "faz-b-test",
      workspacePath: process.cwd(),
      branches: ["feature/stale", "main"],
      stalePrDays: 30,
    });
    expect(report.summary).toBeDefined();
    expect(report.reportMarkdown).toContain("Hygiene Report");
    expect(report.branchCandidates.length).toBeGreaterThan(0);
    expect(report.requiresApproval).toBe(true);
  });

  it("listAgentPresets includes weekly schedules", () => {
    const presets = listAgentPresets();
    expect(presets.runbookIds).toContain("rb-maintenance");
    expect(presets.schedules.some((s) => s.id === "preset-weekly-maintenance")).toBe(true);
  });

  it("GET /agents/presets", async () => {
    const res = await withRead(request.get("/agents/presets"));
    expect(res.status).toBe(200);
    expect(res.body.data.templateIds).toContain("release-manager");
  });

  it("POST /agents/release/analyze with mock PRs", async () => {
    const res = await withRead(request.post("/agents/release/analyze").send({
      repo: "acme/app",
      sinceTag: "v1.0.0",
      prs: SAMPLE_PRS,
    }));
    expect(res.status).toBe(200);
    expect(res.body.data.semver.bump).toBe("major");
  }, 15000);

  it("POST /agents/maintenance/scan", async () => {
    const res = await withRead(request.post("/agents/maintenance/scan").send({ workspacePath: process.cwd() }));
    expect(res.status).toBe(200);
    expect(res.body.data.packageFound).toBe(true);
  });

  it("POST /agents/hygiene/scan", async () => {
    const res = await withRead(request.post("/agents/hygiene/scan").send({
      repo: "acme/app",
      branches: ["feature/old"],
    }));
    expect(res.status).toBe(200);
    expect(res.body.data.reportMarkdown).toBeDefined();
  });

  it("POST /agents/schedules/from-preset creates weekly maintenance schedule", async () => {
    const res = await withWrite(request.post("/agents/schedules/from-preset/preset-weekly-maintenance").send({}));
    expect(res.status).toBe(201);
    expect(res.body.data.runbookId).toBe("rb-maintenance");
    expect(res.body.data.cronExpr).toBe("0 9 * * 1");
  });
});
