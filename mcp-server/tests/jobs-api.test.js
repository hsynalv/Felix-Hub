/**
 * Jobs API Integration Tests
 *
 * Tests covering:
 * - POST /jobs with valid/unknown job types
 * - GET /jobs returns submitted jobs
 * - GET /jobs/:id returns correct job
 * - Failed jobs expose error state
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import supertest from "supertest";

vi.mock("../src/core/config.js", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    config: {
      ...mod.config,
      persistence: {
        ...mod.config.persistence,
        enabled: false,
      },
      redis: {
        ...mod.config.redis,
        enabled: false,
        url: undefined,
      },
    },
  };
});

import {
  registerJobRunner,
  resetJobsForTests,
} from "../src/core/jobs.js";
import { clearHooks as clearToolHooks } from "../src/core/tool-hooks.js";
import { getIntegrationServer } from "./framework/test-server.js";

const WRITE_KEY = "jobs-api-integration-write-key-32";
const READ_KEY = "jobs-api-integration-read-key--32";

let projectId = "test-project";
let app;
let request;

function withWriteAuth(req) {
  return req
    .set("Authorization", `Bearer ${WRITE_KEY}`)
    .set("x-project-id", projectId)
    .set("x-env", "test-env");
}

function withReadAuth(req) {
  return req
    .set("Authorization", `Bearer ${READ_KEY}`)
    .set("x-project-id", projectId)
    .set("x-env", "test-env");
}

function jobsForProject(body, id = projectId) {
  return (body.data?.jobs ?? []).filter((job) => job.context?.projectId === id);
}

function registerTestJobRunners() {
  registerJobRunner("test.job", async (job, updateProgress, log) => {
    await log("Starting test job");
    await updateProgress(50);

    if (job.payload.shouldFail) {
      throw new Error("Job failed as requested");
    }

    await updateProgress(100);
    await log("Test job completed");
    return { processed: true, input: job.payload };
  });

  registerJobRunner("slow.job", async (job, updateProgress, log) => {
    await log("Starting slow job");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await updateProgress(100);
    return { completed: true };
  });
}

describe("Jobs API Integration", () => {
  const envBackup = {};

  beforeAll(async () => {
    envBackup.NODE_ENV = process.env.NODE_ENV;
    envBackup.HUB_WRITE_KEY = process.env.HUB_WRITE_KEY;
    envBackup.HUB_READ_KEY = process.env.HUB_READ_KEY;
    envBackup.REDIS_URL = process.env.REDIS_URL;
    envBackup.HUB_PERSISTENCE_ENABLED = process.env.HUB_PERSISTENCE_ENABLED;
    process.env.NODE_ENV = "test";
    process.env.HUB_WRITE_KEY = WRITE_KEY;
    process.env.HUB_READ_KEY = READ_KEY;
    process.env.HUB_PERSISTENCE_ENABLED = "false";
    delete process.env.REDIS_URL;
    delete process.env.HUB_MSSQL_URL;

    app = await getIntegrationServer();
    request = supertest(app);
    registerTestJobRunners();
  });

  beforeEach(() => {
    projectId = `jobs-api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    resetJobsForTests();
    clearToolHooks();
    registerTestJobRunners();
  });

  afterAll(() => {
    resetJobsForTests();
    clearToolHooks();
    if (envBackup.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = envBackup.NODE_ENV;
    if (envBackup.HUB_WRITE_KEY === undefined) delete process.env.HUB_WRITE_KEY;
    else process.env.HUB_WRITE_KEY = envBackup.HUB_WRITE_KEY;
    if (envBackup.HUB_READ_KEY === undefined) delete process.env.HUB_READ_KEY;
    else process.env.HUB_READ_KEY = envBackup.HUB_READ_KEY;
    if (envBackup.REDIS_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = envBackup.REDIS_URL;
    if (envBackup.HUB_PERSISTENCE_ENABLED === undefined) delete process.env.HUB_PERSISTENCE_ENABLED;
    else process.env.HUB_PERSISTENCE_ENABLED = envBackup.HUB_PERSISTENCE_ENABLED;
  });

  describe("POST /jobs", () => {
    it("should submit job with valid registered type", async () => {
      const response = await withWriteAuth(request
        .post("/jobs"))
        .send({
          type: "test.job",
          payload: { foo: "bar" },
        });

      expect(response.status).toBe(202);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.job).toMatchObject({
        type: "test.job",
        state: "queued",
        context: {
          projectId,
          env: "test-env",
        },
        progress: 0,
      });
      expect(response.body.data.job.id).toBeDefined();
      expect(response.body.data.job.createdAt).toBeDefined();
    });

    it("should return error for unknown job type", async () => {
      const response = await withWriteAuth(request
        .post("/jobs"))
        .send({
          type: "unknown.job.type",
          payload: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe("job_type_not_supported");
      expect(response.body.error.message).toContain("unknown.job.type");
    });

    it("should require job type in request", async () => {
      const response = await withWriteAuth(request
        .post("/jobs"))
        .send({
          payload: { foo: "bar" },
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe("missing_type");
    });
  });

  describe("GET /jobs", () => {
    it("should return submitted jobs", async () => {
      const first = await withWriteAuth(request.post("/jobs")).send({
        type: "test.job",
        payload: { id: 1 },
      });
      const second = await withWriteAuth(request.post("/jobs")).send({
        type: "test.job",
        payload: { id: 2 },
      });

      const response = await withReadAuth(request.get("/jobs"));

      expect(response.status).toBe(200);
      const ids = (response.body.data?.jobs ?? []).map((job) => job.id);
      expect(ids).toEqual(expect.arrayContaining([
        first.body.data.job.id,
        second.body.data.job.id,
      ]));
    });

    it("should filter jobs by type", async () => {
      const testJob = await withWriteAuth(request.post("/jobs")).send({
        type: "test.job",
        payload: {},
      });
      await withWriteAuth(request.post("/jobs")).send({ type: "slow.job", payload: {} });

      const response = await withReadAuth(request.get("/jobs?type=test.job"));

      expect(response.status).toBe(200);
      const ids = (response.body.data?.jobs ?? []).map((job) => job.id);
      expect(ids).toContain(testJob.body.data.job.id);
    });

    it("should return empty array when no jobs", async () => {
      const response = await withReadAuth(request.get("/jobs"));

      expect(response.status).toBe(200);
      expect(jobsForProject(response.body)).toHaveLength(0);
    });
  });

  describe("GET /jobs/:id", () => {
    it("should return correct job by id", async () => {
      const submitResponse = await withWriteAuth(request.post("/jobs")).send({
        type: "test.job",
        payload: { foo: "bar" },
      });

      const jobId = submitResponse.body.data.job.id;

      const response = await withReadAuth(request.get(`/jobs/${jobId}`));

      expect(response.status).toBe(200);
      expect(response.body.data.job).toMatchObject({
        id: jobId,
        type: "test.job",
        state: expect.any(String),
        context: {
          projectId,
          env: "test-env",
        },
        progress: expect.any(Number),
        logCount: expect.any(Number),
        createdAt: expect.any(String),
      });
    });

    it("should return 404 for non-existent job", async () => {
      const response = await withReadAuth(request.get("/jobs/non-existent-id"));

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe("job_not_found");
    });
  });

  describe("Failed job state", () => {
    it("should expose error state for failed jobs", async () => {
      const submitResponse = await withWriteAuth(request.post("/jobs")).send({
        type: "test.job",
        payload: { shouldFail: true },
      });

      const jobId = submitResponse.body.data.job.id;

      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await withReadAuth(request.get(`/jobs/${jobId}`));

      expect(response.status).toBe(200);
      expect(response.body.data.job.state).toBe("failed");
      expect(response.body.data.job.error).toBe("Job failed as requested");
      expect(response.body.data.job.finishedAt).toBeDefined();
    });
  });
});
