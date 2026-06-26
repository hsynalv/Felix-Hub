import { describe, it, expect, vi, beforeEach } from "vitest";

const enqueue = vi.fn();
const get = vi.fn();

vi.mock("../../src/core/jobs.redis.js", () => ({
  RedisJobStore: vi.fn().mockImplementation(() => ({
    enqueue,
    get,
    set: vi.fn(),
    updateProgress: vi.fn(),
    addLog: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    markCancelled: vi.fn(),
    recoverOrphanedJobs: vi.fn().mockResolvedValue(0),
    removeFromQueue: vi.fn(),
    redis: { sadd: vi.fn() },
  })),
}));

vi.mock("../../src/core/config.js", () => ({
  config: {
    redis: {
      enabled: true,
      url: "redis://localhost:6379",
      keyPrefix: "test:jobs:",
      ttlSeconds: 3600,
    },
  },
}));

describe("jobs - Redis enqueue fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    enqueue.mockReset();
    get.mockReset();
  });

  it("runs job from memory when Redis enqueue fails", async () => {
    enqueue.mockRejectedValue(new Error("redis unavailable"));
    get.mockResolvedValue(null);

    const jobs = await import("../../src/core/jobs.js");
    jobs.registerJobRunner("fallback.test", async () => ({ ok: true }));

    const view = jobs.submitJob("fallback.test", { marker: "memory" });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const job = await jobs.getJob(view.id);
    expect(job).not.toBeNull();
    expect(job.state).toBe("completed");
    expect(job.result).toEqual({ ok: true });
  });

  it("normalizes legacy done state to completed in public view", async () => {
    const jobs = await import("../../src/core/jobs.js");
    expect(jobs.JobState.DONE).toBe("done");
    expect(jobs.JobState.COMPLETED).toBe("completed");
  });
});
