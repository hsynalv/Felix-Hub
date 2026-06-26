/**
 * V7 Faz A — Personal Command Center + daily briefing BFF.
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
import { resetInboxForTests } from "../../src/core/inbox/inbox-store.js";
import { buildPersonalBriefing } from "../../src/core/v7/personal-briefing.service.js";

const WRITE_KEY = "v7-faza-write-key-----32-chars!!";
const READ_KEY = "v7-faza-read-key------32-chars!!";

let request;

describe("V7 Faz A", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetInboxForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("buildPersonalBriefing returns today summary", async () => {
    const briefing = await buildPersonalBriefing({ scope: "personal" });
    expect(briefing.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(briefing.summary).toBeTruthy();
    expect(Array.isArray(briefing.bullets)).toBe(true);
    expect(briefing.sources.hub.status).toBe("active");
  });

  it("GET /personal/briefing/today requires auth", async () => {
    const res = await request.get("/personal/briefing/today");
    expect(res.status).toBe(401);
  });

  it("GET /personal/briefing/today returns briefing", async () => {
    const res = await request
      .get("/personal/briefing/today")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.summary).toBeTruthy();
  });

  it("GET /personal/command-center aggregates widgets", async () => {
    const res = await request
      .get("/personal/command-center")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data;
    expect(data.today).toBeDefined();
    expect(data.inbox.summary).toBeDefined();
    expect(Array.isArray(data.suggestedActions)).toBe(true);
    expect(Array.isArray(data.activeRuns)).toBe(true);
    expect(data.mail.status).toBe("not_configured");
    expect(data.telegram.status).toBe("mvp_done");
  });

  it("POST parent run surfaces in command center inbox feed", async () => {
    const parentRes = await request
      .post("/multi-agent/parents")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ goal: "V7 command center feed test" });
    expect(parentRes.status).toBe(201);

    const cc = await request
      .get("/personal/command-center")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(cc.status).toBe(200);
    expect(cc.body.data.today.stats).toBeDefined();
  });
});
