/**
 * Brain fail-closed when DB source of truth but persistence unhealthy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/core/redis.js", () => ({
  getRedis: () => ({
    setex: vi.fn(),
    sadd: vi.fn(),
    get: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("../../src/core/persistence/index.js", () => ({
  isPersistenceHealthy: vi.fn().mockReturnValue(false),
}));

describe("brain fail-closed on DB", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup, BRAIN_FAIL_CLOSED_ON_DB: "true", BRAIN_DB_SOURCE_OF_TRUTH: "true" };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("addMemory throws when fail-closed and DB unhealthy", async () => {
    const { addMemory } = await import("../../src/plugins/brain/brain.memory.js");
    await expect(addMemory({ content: "test memory", type: "fact" })).rejects.toMatchObject({
      code: "brain_persistence_unavailable",
    });
  });

  it("assertBrainPersistenceForWrite throws when unhealthy", async () => {
    const { assertBrainPersistenceForWrite } = await import(
      "../../src/core/persistence/brain-memory.store.js"
    );
    expect(() => assertBrainPersistenceForWrite()).toThrow(/fail-closed/i);
  });
});
