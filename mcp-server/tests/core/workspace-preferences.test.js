/**
 * Workspace preferences service tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkspacePreferences,
  setWorkspacePreferences,
  resetWorkspacePreferencesForTests,
} from "../../src/core/workspace-preferences.service.js";

describe("Workspace preferences", () => {
  const actorId = "test-actor-1";

  beforeEach(() => {
    resetWorkspacePreferencesForTests();
  });

  it("returns defaults when nothing saved", async () => {
    const prefs = await getWorkspacePreferences(actorId);
    expect(prefs.projectId).toBe("default");
    expect(prefs.projectEnv).toBe("development");
    expect(prefs.persisted).toBe(false);
  });

  it("persists project id and env in memory fallback", async () => {
    const saved = await setWorkspacePreferences(actorId, {
      projectId: "acme-app",
      projectEnv: "staging",
    });
    expect(saved.projectId).toBe("acme-app");
    expect(saved.projectEnv).toBe("staging");
    expect(saved.persisted).toBe(true);

    const loaded = await getWorkspacePreferences(actorId);
    expect(loaded.projectId).toBe("acme-app");
    expect(loaded.projectEnv).toBe("staging");
    expect(loaded.persisted).toBe(true);
  });

  it("normalizes invalid env to development", async () => {
    const saved = await setWorkspacePreferences(actorId, {
      projectId: "demo",
      projectEnv: "invalid",
    });
    expect(saved.projectEnv).toBe("development");
  });
});
