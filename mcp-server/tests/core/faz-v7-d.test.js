/**
 * V7 Faz 3 — shopping, life agents, jarvis interface.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
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
import { resetShoppingStoreForTests } from "../../src/core/v7/shopping-store.js";
import { resetLifeAgentsForTests } from "../../src/core/v7/life-agent-store.js";
import { resetJarvisModeForTests } from "../../src/core/v7/jarvis-mode.service.js";
import { searchProducts, requestCartAdd, approveCartRequest } from "../../src/core/v7/shopping-research.service.js";
import { handleTelegramV7Command } from "../../src/core/v7/telegram-commands.js";

const WRITE_KEY = "v7-fazd-write-key-----32-chars!!";
const READ_KEY = "v7-fazd-read-key------32-chars!!";

let request;

describe("V7 Faz 3 (shopping + life + jarvis)", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  beforeEach(() => {
    resetShoppingStoreForTests();
    resetLifeAgentsForTests();
    resetJarvisModeForTests();
  });

  it("searchProducts returns options and session", async () => {
    const result = await searchProducts("kablosuz kulaklık", { persist: true });
    expect(result.sessionId).toBeTruthy();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.paymentNote).toContain("Ödeme");
  });

  it("POST /personal/shopping/search creates session", async () => {
    const res = await request
      .post("/personal/shopping/search")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ query: "laptop stand" });
    expect(res.status).toBe(201);
    expect(res.body.data.results.length).toBeGreaterThan(0);
  });

  it("cart flow requires approval", async () => {
    const search = await searchProducts("mouse", { persist: true });
    const select = await request
      .post(`/personal/shopping/sessions/${search.sessionId}/select`)
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ optionId: search.results[0].id });
    expect(select.status).toBe(200);

    const cart = requestCartAdd(search.sessionId);
    expect(cart.ok).toBe(true);
    expect(cart.data.requiresApproval).toBe(true);

    const approved = approveCartRequest(search.sessionId);
    expect(approved.ok).toBe(true);
    expect(approved.data.cartRequest.status).toBe("approved");
  });

  it("life agent preset CRUD", async () => {
    const presets = await request
      .get("/personal/life-agents/presets")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(presets.status).toBe(200);
    expect(presets.body.data.presets.length).toBeGreaterThan(3);

    const create = await request
      .post("/personal/life-agents")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ presetId: "reminder" });
    expect(create.status).toBe(201);

    const test = await request
      .post(`/personal/life-agents/${create.body.data.id}/test`)
      .set("Authorization", `Bearer ${WRITE_KEY}`);
    expect(test.status).toBe(200);
    expect(test.body.data.dryRun).toBe(true);
  });

  it("PUT /personal/jarvis/mode switches mode", async () => {
    const res = await request
      .put("/personal/jarvis/mode")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ modeId: "shopping" });
    expect(res.status).toBe(200);
    expect(res.body.data.mode.modeId).toBe("shopping");
  });

  it("GET /personal/jarvis/live returns activity", async () => {
    const res = await request
      .get("/personal/jarvis/live")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentActivity).toBeDefined();
    expect(res.body.data.quickActions.length).toBeGreaterThan(0);
  });

  it("handleTelegramV7Command /shopping replies", async () => {
    const messages = [];
    const result = await handleTelegramV7Command("1", "/shopping kulaklık", {
      reply: async (msg) => messages.push(msg),
    });
    expect(result.handled).toBe(true);
    expect(messages[0]).toContain("Seçenekler");
  });

  it("command center includes jarvis and life agents", async () => {
    const res = await request
      .get("/personal/command-center")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.jarvis).toBeDefined();
    expect(Array.isArray(res.body.data.lifeAgents)).toBe(true);
  });
});
