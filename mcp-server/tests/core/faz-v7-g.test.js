/**
 * V7 Faz G — Briefing scheduler, dedup, Gmail OAuth registry.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import supertest from "supertest";
import { mkdtempSync } from "fs";
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
import { resetBriefingSourceStoreForTests, addGmailAccount } from "../../src/core/v7/briefing-source-store.js";
import { resetBriefingStoreForTests } from "../../src/core/v7/briefing-store.js";
import { resetTelegramOutboundStoreForTests } from "../../src/core/v7/telegram-outbound-store.js";
import { resetBriefingScheduleForTests } from "../../src/core/v7/briefing-schedule-store.js";
import { dedupBriefingItems, normalizeBriefingTitle } from "../../src/core/v7/briefing-dedup.js";
import { formatBriefingDigestText } from "../../src/core/v7/briefing-telegram-digest.service.js";
import { tickBriefingSchedule } from "../../src/core/v7/briefing-scheduler.service.js";
import { updateBriefingSchedule } from "../../src/core/v7/briefing-schedule-store.js";
import * as gmailOAuth from "../../src/core/v7/gmail-oauth.service.js";

const WRITE_KEY = "v7-fazg-write-key-----32-chars!!";
const READ_KEY = "v7-fazg-read-key------32-chars!!";

let request;
let storeDir;

describe("V7 Faz G — scheduler, dedup, gmail", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    process.env.BRIEFING_SKIP_IMAP = "true";
    process.env.TELEGRAM_BOT_TOKEN = "123:test";
    process.env.TELEGRAM_CHAT_ID = "999";
    storeDir = mkdtempSync(join(tmpdir(), "v7-briefing-g-"));
    process.env.BRIEFING_SOURCE_STORE_PATH = join(storeDir, "sources.json");
    process.env.PERSONAL_BRIEFING_PATH = join(storeDir, "briefings.json");
    process.env.BRIEFING_SCHEDULE_PATH = join(storeDir, "schedule.json");
    process.env.TELEGRAM_OUTBOUND_LOG_PATH = join(storeDir, "telegram-outbound.json");
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  beforeEach(() => {
    resetBriefingSourceStoreForTests();
    resetBriefingStoreForTests();
    resetTelegramOutboundStoreForTests();
    resetBriefingScheduleForTests();
    vi.restoreAllMocks();
  });

  it("dedupBriefingItems merges same URL across sources", () => {
    const items = dedupBriefingItems([
      {
        id: "1",
        title: "Breaking News",
        link: "https://example.com/story?utm_source=twitter",
        sourceLabel: "BBC",
        importance: 70,
      },
      {
        id: "2",
        title: "Breaking news!",
        link: "https://example.com/story",
        sourceLabel: "RSS Mirror",
        importance: 80,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].importance).toBe(80);
    expect(items[0].dedupMerged).toBe(true);
    expect(items[0].dedupSources).toContain("BBC");
  });

  it("normalizeBriefingTitle strips punctuation", () => {
    expect(normalizeBriefingTitle("Hello, World! — Test")).toBe("hello world test");
  });

  it("formatBriefingDigestText filters actionRequiredOnly", () => {
    const text = formatBriefingDigestText(
      {
        summary: "Özet",
        items: [
          { title: "A", importance: 90, actionRequired: true },
          { title: "B", importance: 50, actionRequired: false },
        ],
      },
      { actionRequiredOnly: true },
    );
    expect(text).toContain("A");
    expect(text).not.toContain("• [50] B");
  });

  it("GET/PUT /personal/briefing/schedule", async () => {
    const getRes = await request
      .get("/personal/briefing/schedule")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.enabled).toBe(false);

    const putRes = await request
      .put("/personal/briefing/schedule")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ enabled: true, hour: 8, minute: 30, pushTelegram: true });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.enabled).toBe(true);
    expect(putRes.body.data.cronExpr).toBe("30 8 * * *");
  });

  it("POST /personal/briefing/schedule/run generates briefing and pushes telegram", async () => {
    updateBriefingSchedule({ enabled: true, pushTelegram: true });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts) => {
      if (String(url).includes("api.telegram.org")) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const res = await request
      .post("/personal/briefing/schedule/run")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.fired).toBe(true);
    expect(res.body.data.pushed).toBe(true);
    fetchSpy.mockRestore();
  });

  it("tickBriefingSchedule skips when already fired today", async () => {
    updateBriefingSchedule({ enabled: true, pushTelegram: false });
    const first = await tickBriefingSchedule(new Date(), { force: true });
    expect(first.fired).toBe(true);

    const second = await tickBriefingSchedule(new Date(), { force: false });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe("already_fired_today");
  });

  it("GET /personal/briefing/gmail lists accounts without refresh token", async () => {
    addGmailAccount({
      email: "test@gmail.com",
      refreshToken: "secret-refresh",
      label: "Test Gmail",
    });

    const res = await request
      .get("/personal/briefing/gmail")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.accounts).toHaveLength(1);
    expect(res.body.data.accounts[0].email).toBe("test@gmail.com");
    expect(res.body.data.accounts[0].hasRefreshToken).toBe(true);
    expect(res.body.data.accounts[0].refreshToken).toBeUndefined();
  });

  it("GET /personal/briefing/gmail/oauth/url requires oauth env", async () => {
    const res = await request
      .get("/personal/briefing/gmail/oauth/url")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("gmail_oauth_not_configured");
  });

  it("GET /personal/briefing/gmail/oauth/url returns auth url when configured", async () => {
    process.env.GMAIL_OAUTH_CLIENT_ID = "cid";
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "csecret";
    const res = await request
      .get("/personal/briefing/gmail/oauth/url")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain("accounts.google.com");
    expect(res.body.data.state).toBeTruthy();
    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
  });

  it("gmail oauth callback rejects invalid state", async () => {
    process.env.GMAIL_OAUTH_CLIENT_ID = "cid";
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "csecret";
    const res = await request.get("/personal/briefing/gmail/oauth/callback?code=abc&state=bad");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Geçersiz OAuth state");
    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
  });

  it("gmail oauth callback saves account on valid flow", async () => {
    process.env.GMAIL_OAUTH_CLIENT_ID = "cid";
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "csecret";
    const { state } = gmailOAuth.getGmailAuthUrl();
    vi.spyOn(gmailOAuth, "exchangeGmailOAuthCode").mockResolvedValue({
      email: "user@gmail.com",
      refreshToken: "rtok",
    });

    const res = await request.get(`/personal/briefing/gmail/oauth/callback?code=good&state=${state}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("user@gmail.com");

    const list = await request
      .get("/personal/briefing/gmail")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(list.body.data.accounts.some((a) => a.email === "user@gmail.com")).toBe(true);

    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
  });
});
