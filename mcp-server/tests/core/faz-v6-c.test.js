/**
 * V6 Faz C — App Store, Compliance, NL Admin, Conflicts, Operating Model.
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
import { resetAppStoreForTests } from "../../src/core/v6-c/app-store-store.js";
import { resetComplianceForTests } from "../../src/core/v6-c/compliance-store.js";
import { resetConflictsForTests } from "../../src/core/v6-c/conflict-store.js";
import { resetOperatingModelForTests } from "../../src/core/v6-c/operating-model-store.js";
import { parseNLAdminCommand } from "../../src/core/v6-c/nl-admin.service.js";
import { getOperatingModelPromptContext } from "../../src/core/v6-c/operating-model-store.js";

const WRITE_KEY = "v6-fazc-write-key---32-chars!!";
const READ_KEY = "v6-fazc-read-key-----32-chars!!";
const ADMIN_KEY = WRITE_KEY;

let request;

describe("V6 Faz C", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = ADMIN_KEY;
    resetAppStoreForTests();
    resetComplianceForTests();
    resetConflictsForTests();
    resetOperatingModelForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("GET /app-store/products returns catalog with trust and cost", async () => {
    const res = await request.get("/app-store/products").set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
    expect(res.body.data.products[0]).toHaveProperty("trustScore");
    expect(res.body.data.products[0]).toHaveProperty("costEstimateUsd");
  });

  it("installs incident responder product without github", async () => {
    const res = await request
      .post("/app-store/products/agent-incident-responder/install")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ projectId: "default" });
    expect(res.status).toBe(201);
    expect(res.body.data.installation.productId).toBe("agent-incident-responder");
  });

  it("NL admin parses autonomy command", () => {
    const parsed = parseNLAdminCommand("production için L2 autonomy", { projectId: "default" });
    expect(parsed.ok).toBe(true);
    expect(parsed.data.intentId).toBe("set_autonomy_level");
    expect(parsed.data.preview.summary).toContain("production");
  });

  it("POST /nl-admin/execute requires confirm", async () => {
    const res = await request
      .post("/nl-admin/execute")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ command: "aylık $10 limit koy", confirm: false });
    expect(res.status).toBe(428);
  });

  it("POST /conflicts/detect returns report for auth topic", async () => {
    const res = await request
      .post("/conflicts/detect")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ topic: "auth jwt api key" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("sources");
    expect(res.body.data).toHaveProperty("conflicts");
  });

  it("operating model remember injects prompt context", async () => {
    const res = await request
      .post("/operating-model/remember")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ key: "pr_review", value: "test coverage iste", scope: "global" });
    expect(res.status).toBe(201);

    const ctx = getOperatingModelPromptContext({ projectId: null });
    expect(ctx).toContain("pr_review");
    expect(ctx).toContain("test coverage");
  });

  it("GET /compliance/report returns admin summary", async () => {
    const res = await request.get("/compliance/report").set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("policy");
    expect(res.body.data).toHaveProperty("retention");
  });
});
