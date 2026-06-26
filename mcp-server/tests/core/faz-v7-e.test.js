/**
 * V7 Faz 4 — feedback loop, memory explain, jarvis overlay.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import supertest from "supertest";
import { join } from "path";
import { tmpdir } from "os";

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
import { resetBriefingFeedbackForTests } from "../../src/core/v7/briefing-feedback-store.js";
import { applyBriefingFeedbackToItems, submitBriefingFeedback } from "../../src/core/v7/briefing-feedback.service.js";
import { getJarvisOverlayStatus } from "../../src/core/v7/jarvis-mode.service.js";

const WRITE_KEY = "v7-faze-write-key-----32-chars!!";
const READ_KEY = "v7-faze-read-key------32-chars!!";

let request;

describe("V7 Faz 4 (maturity)", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    process.env.OPERATING_MODEL_PATH = join(tmpdir(), `v7-faze-om-${Date.now()}.json`);
    process.env.BRIEFING_FEEDBACK_PATH = join(tmpdir(), `v7-faze-fb-${Date.now()}.json`);
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  beforeEach(() => {
    resetBriefingFeedbackForTests();
  });

  it("submitBriefingFeedback and applyBriefingFeedbackToItems", () => {
    submitBriefingFeedback({ itemId: "item-1", feedback: "show_less" });
    submitBriefingFeedback({ itemId: "item-1", feedback: "show_less" });
    const items = applyBriefingFeedbackToItems([
      { id: "item-1", importance: 50 },
      { id: "item-2", importance: 40 },
    ]);
    expect(items.find((i) => i.id === "item-1")?.importance).toBeLessThan(50);
    expect(items.find((i) => i.id === "item-2")).toBeTruthy();
  });

  it("hides items after repeated not_relevant", () => {
    submitBriefingFeedback({ itemId: "bad", feedback: "not_relevant" });
    submitBriefingFeedback({ itemId: "bad", feedback: "not_relevant" });
    const items = applyBriefingFeedbackToItems([{ id: "bad", importance: 90 }]);
    expect(items.find((i) => i.id === "bad")).toBeUndefined();
  });

  it("POST /personal/briefing/feedback", async () => {
    const res = await request
      .post("/personal/briefing/feedback")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ itemId: "inbox-1", feedback: "relevant" });
    expect(res.status).toBe(201);
    expect(res.body.data.itemId).toBe("inbox-1");
  });

  it("explainPersonalMemory via API", async () => {
    const remember = await request
      .post("/personal/memory/remember")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ key: "style", value: "short" });
    expect(remember.status).toBe(201);
    const explained = await request
      .get(`/personal/memory/${remember.body.data.id}/explain`)
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(explained.status).toBe(200);
    expect(explained.body.data.explanation).toContain("kaydettiniz");
  });

  it("GET /personal/memory/:id/explain", async () => {
    const remember = await request
      .post("/personal/memory/remember")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ key: "tz", value: "Europe/Istanbul" });
    const res = await request
      .get(`/personal/memory/${remember.body.data.id}/explain`)
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.key).toBe("tz");
  });

  it("PUT /personal/memory/:id updates value", async () => {
    const remember = await request
      .post("/personal/memory/remember")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ key: "lang", value: "tr" });
    const res = await request
      .put(`/personal/memory/${remember.body.data.id}`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ value: "en" });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe("en");
  });

  it("GET /personal/jarvis/overlay returns compact status", async () => {
    const res = await request
      .get("/personal/jarvis/overlay")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toBeTruthy();
    expect(res.body.data.modeId).toBeTruthy();
  });

  it("getJarvisOverlayStatus service", async () => {
    const overlay = await getJarvisOverlayStatus();
    expect(overlay.status).toBeDefined();
    expect(overlay.updatedAt).toBeTruthy();
  });
});
