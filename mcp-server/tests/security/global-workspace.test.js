/**
 * Global workspace read-only in production.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolTags } from "../../src/core/tool-tags.js";

vi.mock("../../src/core/policy-hooks.js", () => ({
  getPolicyEvaluator: vi.fn(() => null),
}));

vi.mock("../../src/core/workspace-permissions.js", () => ({
  canRunTool: vi.fn().mockResolvedValue({ allowed: true }),
  checkCrossWorkspaceAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe("global workspace read-only", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      NODE_ENV: "test",
      GLOBAL_WORKSPACE_READ_ONLY: "true",
      HUB_WRITE_KEY: "write-key-test-global-ws-xx",
      HUB_READ_KEY: "read-key-test-global-ws-xx",
      HUB_ADMIN_KEY: "admin-key-test-global-ws-x",
    };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("blocks write tools in global workspace", async () => {
    const { authorizeToolCall } = await import("../../src/core/authorization/authorize-tool-call.js");
    const block = await authorizeToolCall({
      name: "workspace_write_file",
      tool: { plugin: "workspace", tags: [ToolTags.WRITE, ToolTags.LOCAL_FS] },
      args: { path: "foo.txt", content: "x" },
      context: { workspaceId: "global", authScopes: ["write"], actor: { type: "api_key", scopes: ["write"] } },
    });
    expect(block?.ok).toBe(false);
    expect(block?.error?.code).toBe("global_workspace_write_forbidden");
  });

  it("allows read tools in global workspace", async () => {
    const { authorizeToolCall } = await import("../../src/core/authorization/authorize-tool-call.js");
    const block = await authorizeToolCall({
      name: "workspace_list",
      tool: { plugin: "workspace", tags: [ToolTags.READ_ONLY, ToolTags.LOCAL_FS] },
      args: {},
      context: { workspaceId: "global", authScopes: ["read"], actor: { type: "api_key", scopes: ["read"] } },
    });
    expect(block).toBeNull();
  });
});
