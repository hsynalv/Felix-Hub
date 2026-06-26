/**
 * V5 Faz C — Reports, SLA, Incident Triage, Env Promotion tests.
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
import { generateBriefing, deliverBriefing } from "../../src/core/reports/briefing.service.js";
import { resetBriefingsForTests } from "../../src/core/reports/briefing-store.js";
import {
  getSlaPolicy,
  setSlaPolicy,
  evaluateScheduleFailures,
  recordScheduleRunOutcome,
} from "../../src/core/sla/sla.service.js";
import { resetSlaForTests, incrementFailureStreak } from "../../src/core/sla/sla-store.js";
import { triageIncident } from "../../src/core/agents/incident-triage.service.js";
import { diffConfigs, maskSecrets, setEnvironmentRegistry } from "../../src/core/env/env-registry.service.js";
import {
  createPromotionRequest,
  approvePromotionStep,
  resetPromotionsForTests,
} from "../../src/core/env/promotion.service.js";
import { createSchedule, resetSchedulesForTests } from "../../src/core/ops/schedule-store.js";
import { fireSchedule } from "../../src/core/ops/schedule.service.js";
import { REPORT_TEMPLATES } from "../../src/core/reports/report-templates.js";

const WRITE_KEY = "faz-c-v5-write-key-32-chars!!";
const READ_KEY = "faz-c-v5-read-key---32-chars!!";

let request;

function withWrite(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", "faz-c-test")
    .set("x-env", "staging");
}

function withRead(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", "faz-c-test")
    .set("x-env", "staging");
}

describe("V5 Faz C", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetBriefingsForTests();
    resetSlaForTests();
    resetPromotionsForTests();
    resetSchedulesForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("report templates include daily engineering", () => {
    expect(REPORT_TEMPLATES.daily_engineering).toBeDefined();
    expect(REPORT_TEMPLATES.daily_engineering.scheduleCron).toBe("0 8 * * *");
  });

  it("generateBriefing creates inbox entry", async () => {
    const briefing = await generateBriefing({ type: "daily_engineering", projectId: "faz-c-test" });
    expect(briefing.id).toBeDefined();
    expect(briefing.markdown).toContain("Daily Engineering Brief");
    expect(briefing.type).toBe("daily_engineering");
  });

  it("deliverBriefing logs or sends via notifications", async () => {
    const briefing = await generateBriefing({ type: "risk", projectId: "faz-c-test" });
    const delivery = await deliverBriefing(briefing.id, { channel: "native" });
    expect(delivery.ok).toBe(true);
  });

  it("maskSecrets hides secret values in config diff", () => {
    const masked = maskSecrets({ apiUrl: "https://x.com", apiKey: "super-secret-key" });
    expect(masked.apiKey).toMatch(/^\*\*\*\*/);
    expect(masked.apiUrl).toBe("https://x.com");

    const diff = diffConfigs(
      { apiKey: "old-secret-value" },
      { apiKey: "new-secret-value", feature: true }
    );
    expect(diff.masked).toBe(true);
    expect(diff.diffCount).toBeGreaterThan(0);
  });

  it("staging to production promotion requires approval chain", () => {
    setEnvironmentRegistry("faz-c-test", {
      environments: {
        staging: { config: { version: "1.0" } },
        production: { config: { version: "0.9" } },
      },
    });

    const promo = createPromotionRequest({
      projectId: "faz-c-test",
      fromEnv: "staging",
      toEnv: "production",
      changeSummary: "Release v2",
    });
    expect(promo.status).toBe("pending_approval");
    expect(promo.approvalChain).toContain("release_manager");
    expect(promo.rollbackRequired).toBe(true);

    let updated = approvePromotionStep(promo.id, { role: "tech_lead" });
    expect(updated?.status).toBe("pending_approval");

    updated = approvePromotionStep(promo.id, { role: "release_manager" });
    expect(updated?.status).toBe("approved");
  });

  it("triageIncident produces timeline and suspected causes", async () => {
    const result = await triageIncident({
      repo: "acme/app",
      projectId: "faz-c-test",
      errorSignal: { spike: true, message: "5xx rate elevated", detectedAt: new Date().toISOString() },
    });
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.suspectedCauses.length).toBeGreaterThan(0);
    expect(result.postmortemDraft).toContain("Postmortem");
    expect(result.recommendedActions.some((a) => a.action === "rollback")).toBe(true);
  });

  it("SLA pauses schedule after 3 consecutive failures", async () => {
    setSlaPolicy("default", { runFailureThreshold: 3 });
    const schedule = createSchedule({
      name: "fail test",
      reportType: "daily_engineering",
      cronExpr: "0 8 * * *",
      projectId: "faz-c-test",
    });

    incrementFailureStreak(schedule.id);
    incrementFailureStreak(schedule.id);
    recordScheduleRunOutcome(schedule.id, "blocked");
    expect(recordScheduleRunOutcome(schedule.id, "blocked")?.shouldEscalate).toBe(true);

    const evalResult = await evaluateScheduleFailures();
    expect(evalResult.escalated).toBeGreaterThanOrEqual(1);
  });

  it("briefing schedule fires and generates report", async () => {
    const schedule = createSchedule({
      name: "daily brief test",
      reportType: "daily_engineering",
      cronExpr: "0 8 * * *",
      projectId: "faz-c-test",
    });
    const result = await fireSchedule(schedule.id, { test: true });
    expect(result.fired).toBe(true);
    expect(result.outcome).toBe("briefing_generated");
    expect(result.briefing?.markdown).toBeDefined();
  });

  it("GET /reports/briefings", async () => {
    await generateBriefing({ type: "daily_engineering", projectId: "faz-c-test" });
    const res = await withRead(request.get("/reports/briefings"));
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  it("POST /reports/daily", async () => {
    const res = await withWrite(request.post("/reports/daily").send({}));
    expect(res.status).toBe(201);
    expect(res.body.data.briefing).toBeDefined();
  });

  it("GET /sla/policy returns defaults", async () => {
    const res = await withRead(request.get("/sla/policy"));
    expect(res.status).toBe(200);
    expect(res.body.data.approvalTimeoutHours).toBe(4);
  });

  it("POST /agents/incident/triage", async () => {
    const res = await withRead(request.post("/agents/incident/triage").send({ repo: "acme/app" }));
    expect(res.status).toBe(200);
    expect(res.body.data.suspectedCauses.length).toBeGreaterThan(0);
  });

  it("POST /env/promotions staging to production", async () => {
    const res = await withWrite(
      request.post("/env/promotions").send({
        fromEnv: "staging",
        toEnv: "production",
        changeSummary: "v2 release",
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.approvalChain.length).toBe(2);
  });

  it("POST /env/diff masks secrets", async () => {
    setEnvironmentRegistry("faz-c-test", {
      environments: {
        staging: { config: { dbPassword: "staging-secret" } },
        production: { config: { dbPassword: "prod-secret" } },
      },
    });
    const res = await withRead(
      request.post("/env/diff").send({ projectId: "faz-c-test", fromEnv: "staging", toEnv: "production" })
    );
    expect(res.status).toBe(200);
    expect(res.body.data.masked).toBe(true);
    const diffStr = JSON.stringify(res.body.data.diffs);
    expect(diffStr).not.toContain("staging-secret");
    expect(diffStr).not.toContain("prod-secret");
  });
});
