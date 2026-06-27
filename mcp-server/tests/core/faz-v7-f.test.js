/**
 * V7 Faz F — Briefing source connectors (RSS + IMAP registry).
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
import { resetBriefingSourceStoreForTests } from "../../src/core/v7/briefing-source-store.js";
import { resetBriefingStoreForTests } from "../../src/core/v7/briefing-store.js";
import { logTelegramOutbound, resetTelegramOutboundStoreForTests } from "../../src/core/v7/telegram-outbound-store.js";
import { parseFeedXml } from "../../src/core/v7/rss-connector.service.js";
import { generateDailyBriefing } from "../../src/core/v7/daily-briefing.service.js";

const WRITE_KEY = "v7-fazf-write-key-----32-chars!!";
const READ_KEY = "v7-fazf-read-key------32-chars!!";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Breaking AI News</title>
      <link>https://example.com/ai-news</link>
      <description>Agents everywhere</description>
      <pubDate>Fri, 26 Jun 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Duplicate headline</title>
      <link>https://example.com/dup</link>
      <description>First</description>
    </item>
  </channel>
</rss>`;

let request;
let storeDir;

describe("V7 Faz F — briefing connectors", () => {
  beforeAll(async () => {
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_ADMIN_KEY = WRITE_KEY;
    process.env.BRIEFING_SKIP_IMAP = "true";
    storeDir = mkdtempSync(join(tmpdir(), "v7-briefing-src-"));
    process.env.BRIEFING_SOURCE_STORE_PATH = join(storeDir, "sources.json");
    process.env.PERSONAL_BRIEFING_PATH = join(storeDir, "briefings.json");
    process.env.TELEGRAM_OUTBOUND_LOG_PATH = join(storeDir, "telegram-outbound.json");
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  beforeEach(() => {
    resetBriefingSourceStoreForTests();
    resetBriefingStoreForTests();
    resetTelegramOutboundStoreForTests();
  });

  function mockRssFetch() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("feed.xml")) {
        return new Response(SAMPLE_RSS, {
          status: 200,
          headers: { "content-type": "application/rss+xml", etag: '"abc"' },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  async function registerTestFeed(request) {
    const res = await request
      .post("/personal/briefing/feeds")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ url: "https://example.com/feed.xml", label: "Example" });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it("parseFeedXml extracts RSS items", () => {
    const items = parseFeedXml(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Breaking AI News");
    expect(items[0].link).toBe("https://example.com/ai-news");
  });

  it("POST /personal/briefing/feeds registers RSS feed", async () => {
    const res = await request
      .post("/personal/briefing/feeds")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ url: "https://example.com/feed.xml", label: "Example" });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe("https://example.com/feed.xml");
    expect(res.body.data.enabled).toBe(true);
  });

  it("GET /personal/briefing/sources shows rss active after feed + mock fetch", async () => {
    await registerTestFeed(request);
    mockRssFetch();

    const gen = await request
      .post("/personal/briefing/generate")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({ scope: "personal" });
    expect(gen.status).toBe(201);
    if (gen.body.data.externalErrors?.length) {
      throw new Error(JSON.stringify(gen.body.data.externalErrors));
    }
    const rssItems = gen.body.data.items.filter((i) => i.source === "rss");
    expect(rssItems.length).toBeGreaterThan(0);
    expect(rssItems[0].title).toBe("Breaking AI News");

    const sources = await request
      .get("/personal/briefing/sources")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(sources.status).toBe(200);
    const rss = sources.body.data.sources.find((s) => s.id === "rss");
    expect(rss.status).toBe("active");
    expect(rss.configuredCount).toBe(1);
  });

  it("generateDailyBriefing deduplicates items by dedupKey", async () => {
    await registerTestFeed(request);
    mockRssFetch();

    const briefing = await generateDailyBriefing({ persist: false });
    const titles = briefing.items.filter((i) => i.source === "rss").map((i) => i.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("POST /personal/briefing/imap stores account without password", async () => {
    const res = await request
      .post("/personal/briefing/imap")
      .set("Authorization", `Bearer ${WRITE_KEY}`)
      .send({
        host: "imap.gmail.com",
        user: "me@gmail.com",
        passwordEnvKey: "BRIEFING_IMAP_PASS",
        label: "Gmail",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.passwordEnvKey).toBe("BRIEFING_IMAP_PASS");
    expect(res.body.data).not.toHaveProperty("password");

    const list = await request
      .get("/personal/briefing/imap")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(list.body.data.accounts).toHaveLength(1);
  });

  it("GET /personal/telegram/outbound lists outbound messages", async () => {
    logTelegramOutbound({
      chatId: "12345",
      text: "Günlük brifing özeti",
      source: "telegram_commands",
      success: true,
    });

    const res = await request
      .get("/personal/telegram/outbound")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.messages[0].preview).toContain("Günlük brifing");
  });

  it("command center news widget populated when RSS configured", async () => {
    await registerTestFeed(request);
    mockRssFetch();

    const cc = await request
      .get("/personal/command-center")
      .set("Authorization", `Bearer ${READ_KEY}`);
    expect(cc.status).toBe(200);
    expect(cc.body.data.news.status).toBe("active");
    expect(cc.body.data.news.items.length).toBeGreaterThan(0);
  });
});
