/**
 * V7 Faz 1 (devam) — briefing, memory, telegram pause.
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
import { resetBriefingStoreForTests } from "../../src/core/v7/briefing-store.js";
import { resetHubPauseForTests } from "../../src/core/v7/telegram-pause.js";
import { resetOperatingModelForTests } from "../../src/core/v6-c/operating-model-store.js";
import { generateDailyBriefing } from "../../src/core/v7/daily-briefing.service.js";
import { handleTelegramV7Command } from "../../src/core/v7/telegram-commands.js";
import { isHubPaused, setHubPause, clearHubPause } from "../../src/core/v7/telegram-pause.js";

const WRITE_KEY = "v7-fazb-write-key-----32-chars!!";
const READ_KEY = "v7-fazb-read-key------32-chars!!";

let request;

describe("V7 Faz 1 (briefing + memory + telegram)", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  beforeEach(() => {
    resetBriefingStoreForTests();
    resetHubPauseForTests();
    resetOperatingModelForTests();
  });

  it("generateDailyBriefing persists scored items", async () => {
    const briefing = await generateDailyBriefing({ scope: "personal", persist: true });
    expect(briefing.id).toBeTruthy();
    expect(briefing.summary).toBeTruthy();
    expect(Array.isArray(briefing.items)).toBe(true);
    expect(briefing.sources.length).toBeGreaterThan(0);
  });

  it("POST /personal/briefing/generate creates briefing", async () => {
    const res = await request
      .post("/personal/briefing/generate")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ scope: "personal" });
    expect(res.status).toBe(201);
    expect(res.body.data.items).toBeDefined();
  });

  it("POST /personal/memory/remember and GET /personal/memory", async () => {
    const remember = await request
      .post("/personal/memory/remember")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ key: "briefing_style", value: "short", pinned: true });
    expect(remember.status).toBe(201);

    const list = await request
      .get("/personal/memory")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(list.status).toBe(200);
    expect(list.body.data.count).toBeGreaterThanOrEqual(1);
    expect(list.body.data.preferences.some((p) => p.key === "briefing_style")).toBe(true);
  });

  it("telegram hub pause blocks via isHubPaused", () => {
    expect(isHubPaused()).toBe(false);
    setHubPause({ chatId: "123", minutes: 5 });
    expect(isHubPaused()).toBe(true);
    clearHubPause();
    expect(isHubPaused()).toBe(false);
  });

  it("handleTelegramV7Command /brief replies", async () => {
    const messages = [];
    const result = await handleTelegramV7Command("999", "/brief", {
      reply: async (msg) => {
        messages.push(msg);
      },
    });
    expect(result.handled).toBe(true);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain("Bugün");
  });

  it("GET /personal/hub-pause returns state", async () => {
    setHubPause({ chatId: "1", minutes: 10 });
    const res = await request
      .get("/personal/hub-pause")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.paused).toBe(true);
  });
});
