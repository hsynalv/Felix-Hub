/**
 * Smoke Tests
 * Basic server boot and health checks.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import supertest from "supertest";

vi.mock("../src/core/config.js", async (importOriginal) => {
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

import { getIntegrationServer } from "./framework/test-server.js";

describe("Smoke Tests", () => {
  let request;

  beforeAll(async () => {
    const app = await getIntegrationServer();
    request = supertest(app);
  }, 60000);

  it("should boot without errors", async () => {
    expect(request).toBeDefined();
  });

  it("should respond to /health", async () => {
    const response = await request.get("/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.status).toBe("ok");
  });

  it("should respond to /whoami", async () => {
    const response = await request.get("/whoami");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.auth).toBeDefined();
  });

  it("should return validation error for invalid request", async () => {
    const response = await request.post("/http/request").send({});
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("missing_project_id");
  });

  it("should return 404 for unknown routes", async () => {
    const response = await request.get("/unknown-route");
    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("not_found");
  });
});
