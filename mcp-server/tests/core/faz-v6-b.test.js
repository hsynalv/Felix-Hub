/**
 * V6 Faz B — inbox + observability pro.
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
import { getObservabilityProDashboard } from "../../src/core/observability-pro/observability-pro.service.js";

const WRITE_KEY = "v6-fazb-write-key---32-chars!!";
const READ_KEY = "v6-fazb-read-key----32-chars!!";

let request;

describe("V6 Faz B", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    resetInboxForTests();
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("GET /inbox/items returns unified feed", async () => {
    const parentRes = await request
      .post("/multi-agent/parents")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ goal: "Inbox feed test" });
    expect(parentRes.status).toBe(201);

    const spawnRes = await request
      .post(`/multi-agent/parents/${parentRes.body.data.id}/spawn`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ role: "executor", templateId: "incident-triage", dryRun: true });
    expect(spawnRes.status).toBe(201);

    const res = await request.get("/inbox/items").set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(
      res.body.data.items.some(
        (i) => i.runId === spawnRes.body.data.id || i.type.startsWith("run_")
      )
    ).toBe(true);
  });

  it("POST /inbox/items/:id/read and snooze", async () => {
    const listRes = await request.get("/inbox/items").set("Authorization", `Bearer ${READ_KEY}`);
    const item = listRes.body.data.items[0];
    if (!item) return;

    const readRes = await request
      .post(`/inbox/items/${encodeURIComponent(item.id)}/read`)
      .set("Authorization", `Bearer ${WRITE_KEY}`);
    expect(readRes.status).toBe(200);

    const snoozeRes = await request
      .post(`/inbox/items/${encodeURIComponent(item.id)}/snooze`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ minutes: 30 });
    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.data.snoozedUntil).toBeTruthy();
  });

  it("GET /inbox/summary returns counts", async () => {
    const res = await request.get("/inbox/summary").set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("unreadCount");
    expect(res.body.data).toHaveProperty("byType");
  });

  it("GET /observability-pro/dashboard returns agent metrics", async () => {
    const res = await request
      .get("/observability-pro/dashboard?days=7")
      .set("Accept", "application/json")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("failureHotspots");
    expect(res.body.data).toHaveProperty("approvalBottlenecks");
    expect(res.body.data).toHaveProperty("reliabilityTrend");
    expect(res.body.data).toHaveProperty("totalCostUsd");
  });

  it("getObservabilityProDashboard aggregates run stats", async () => {
    const dash = await getObservabilityProDashboard({ days: 7 });
    expect(dash.runs.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(dash.failureHotspots)).toBe(true);
  });
});
