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
});
