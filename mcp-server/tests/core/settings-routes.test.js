/**
 * Settings REST routes — auth and basic responses (mocked persistence)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/core/settings/settings.service.js", () => ({
  listSettings: vi.fn().mockResolvedValue([{ keyName: "OPENAI_API_KEY", masked: true }]),
  upsertSetting: vi.fn().mockResolvedValue({ keyName: "OPENAI_API_KEY" }),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  getSettingDecrypted: vi.fn().mockResolvedValue(null),
  listConnectionProfiles: vi.fn().mockResolvedValue([]),
  upsertConnectionProfile: vi.fn(),
  writeConfigAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/core/persistence/index.js", () => ({
  isPersistenceHealthy: vi.fn().mockReturnValue(false),
}));

vi.mock("../../src/core/settings/reload-registry.js", () => ({
  runSettingsReload: vi.fn().mockResolvedValue({ reloaded: [] }),
}));

vi.mock("../../src/core/settings/rotation.service.js", () => ({
  rotateMasterKey: vi.fn(),
}));

vi.mock("../../src/core/settings/bundle.service.js", () => ({
  exportSettingsBundle: vi.fn().mockResolvedValue({}),
  importSettingsBundle: vi.fn().mockResolvedValue({ imported: 0 }),
}));

vi.mock("../../src/core/settings/templates.js", () => ({
  listTemplates: vi.fn().mockReturnValue([]),
  applyTemplate: vi.fn(),
}));

vi.mock("../../src/core/settings/diff.service.js", () => ({
  computeSettingsDiff: vi.fn().mockReturnValue({ changes: [] }),
}));

vi.mock("../../src/core/settings/validate.service.js", () => ({
  validateKeys: vi.fn().mockReturnValue({ ok: true, results: [] }),
  validateSingleKey: vi.fn().mockReturnValue({ ok: true }),
}));

vi.mock("../../src/core/plugins.js", () => ({
  getPlugins: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/core/mcp-connectors/connector.service.js", () => ({
  listConnectors: vi.fn().mockResolvedValue([]),
}));

import { registerSettingsRoutes } from "../../src/core/settings/routes.js";
import { withHubSecurityMiddleware } from "../helpers/route-auth.js";

const ADMIN_KEY = "test-admin-key-phase2-xxxxxxxx";

describe("settings/routes", () => {
  let app;
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, NODE_ENV: "test" };
    process.env.HUB_ADMIN_KEY = ADMIN_KEY;
    delete process.env.HUB_READ_KEY;
    delete process.env.HUB_WRITE_KEY;

    app = express();
    app.use(express.json());
    withHubSecurityMiddleware(app);
    registerSettingsRoutes(app);
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("GET /settings/ requires admin auth", async () => {
    const res = await request(app).get("/settings/");
    expect(res.status).toBe(401);
  });

  it("GET /settings/ rejects read-only key", async () => {
    process.env.HUB_READ_KEY = "read-only-key-for-tests-xx";
    const res = await request(app)
      .get("/settings/")
      .set("Accept", "application/json")
      .set("Authorization", "Bearer read-only-key-for-tests-xx");
    expect(res.status).toBe(403);
  });

  it("GET /settings/ succeeds with admin key", async () => {
    const res = await request(app)
      .get("/settings/")
      .set("Accept", "application/json")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.settings).toBeDefined();
  });

  it("GET /settings/effective returns masked config", async () => {
    const res = await request(app)
      .get("/settings/effective")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it("GET /settings/:key/reveal returns non-secret bootstrap env values", async () => {
    process.env.PORT = "8787";
    const res = await request(app)
      .get("/settings/PORT/reveal")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe("8787");
    expect(res.body.data.source).toBe("env");
  });

  it("GET /settings/:key/reveal blocks hub API keys", async () => {
    process.env.HUB_ADMIN_KEY = ADMIN_KEY;
    const res = await request(app)
      .get("/settings/HUB_ADMIN_KEY/reveal")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("GET /settings/env-catalog excludes hub bootstrap group", async () => {
    const res = await request(app)
      .get("/settings/env-catalog")
      .set("Authorization", `Bearer ${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    const plugins = res.body.data.groups.map((g) => g.plugin);
    expect(plugins).not.toContain("hub");
    expect(plugins).not.toContain("llm-router");
    expect(plugins).toContain("notion");
  });

  it("PUT /settings/:key rejects bootstrap keys", async () => {
    const res = await request(app)
      .put("/settings/PORT")
      .set("Authorization", `Bearer ${ADMIN_KEY}`)
      .send({ value: "9999" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bootstrap_key");
  });
});
