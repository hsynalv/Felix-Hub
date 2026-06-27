/**
 * Tool discovery filtering — read keys must not see write/destructive tools.
 */

import { describe, it, expect } from "vitest";
import { filterVisibleTools } from "../../src/core/authorization/filter-visible-tools.js";
import { ToolTags } from "../../src/core/tool-tags.js";

const sampleTools = [
  { name: "read_tool", plugin: "demo", tags: [ToolTags.READ_ONLY] },
  { name: "shell_execute", plugin: "shell", tags: [ToolTags.WRITE, ToolTags.DESTRUCTIVE] },
  { name: "admin_tool", plugin: "demo", tags: [ToolTags.WRITE, ToolTags.NEEDS_APPROVAL] },
];

describe("filterVisibleTools — discovery hardening", () => {
  it("hides write/destructive tools from read-only principal", () => {
    const visible = filterVisibleTools(sampleTools, {
      workspaceId: "global",
      scopes: ["read"],
    });
    const names = visible.map((t) => t.name);
    expect(names).toContain("read_tool");
    expect(names).not.toContain("shell_execute");
    expect(names).not.toContain("admin_tool");
  });

  it("shows write tools to write principal", () => {
    const visible = filterVisibleTools(sampleTools, {
      workspaceId: "global",
      scopes: ["write"],
    });
    const names = visible.map((t) => t.name);
    expect(names).toContain("shell_execute");
    expect(names).toContain("admin_tool");
  });
});
