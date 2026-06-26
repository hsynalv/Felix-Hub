/**
 * V5 hardening — export, webhooks, SLA gate, hygiene extensions.
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

import { getIntegrationServer } from "../framework/test-server.js";
import { renderBriefingHtml, renderBriefingPdfBuffer } from "../../src/core/reports/briefing-export.js";
import {
  ingestObservabilitySignal,
  resetObservabilitySignalsForTests,
} from "../../src/core/integrations/observability-webhook-store.js";
import { fetchObservabilityErrorSignal } from "../../src/core/agents/observability-signal.js";
import { detectUnusedIntegrationSecrets } from "../../src/core/agents/hygiene.service.js";
import { enforceWorkflowStepSla } from "../../src/core/agent-runs/workflow-sla-gate.js";
import { detectEcosystems } from "../../src/core/agents/maintenance.service.js";

const WRITE_KEY = "v5-hard-write-key---32-chars!!";
const READ_KEY = "v5-hard-read-key----32-chars!!";

let request;

describe("V5 hardening", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetObservabilitySignalsForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("renders briefing HTML and PDF export buffers", () => {
    const briefing = { title: "Test Brief", markdown: "# Hello\n\n- item", createdAt: new Date().toISOString() };
    const html = renderBriefingHtml(briefing);
    expect(html).toContain("<h1>Test Brief</h1>");
    const pdf = renderBriefingPdfBuffer(briefing);
    expect(pdf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("GET /sla/dashboard returns dashboard metrics", async () => {
    const res = await request
      .get("/sla/dashboard")
      .set("Authorization", `Bearer ${READ_KEY}`)
      .set("x-project-id", "default");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty("totalViolations");
    expect(res.body.data).toHaveProperty("byRule");
  });

  it("POST /integrations/observability/generic ingests signal", async () => {
    const res = await request
      .post("/integrations/observability/generic")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ message: "Test spike", source: "test", spike: true });
    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe("test");
  });

  it("fetchObservabilityErrorSignal prefers external webhook signal", async () => {
    resetObservabilitySignalsForTests();
    ingestObservabilitySignal({ source: "datadog", message: "Monitor fired", spike: true });
    const signal = await fetchObservabilityErrorSignal({ projectId: null });
    expect(signal?.source).toBe("datadog");
    expect(signal?.spike).toBe(true);
  });

  it("detectUnusedIntegrationSecrets returns heuristic shape", async () => {
    const result = await detectUnusedIntegrationSecrets({ auditLimit: 10 });
    expect(result).toHaveProperty("configured");
    expect(result).toHaveProperty("unused");
  });

  it("enforceWorkflowStepSla skips below L4", async () => {
    const gate = await enforceWorkflowStepSla({ projectEnv: "development", autonomyLevel: "L2" });
    expect(gate.ok).toBe(true);
    expect(gate.skipped).toBe(true);
  });

  it("detectEcosystems finds npm marker in repo", () => {
    const ecosystems = detectEcosystems(".");
    expect(ecosystems).toContain("npm");
  });
});
