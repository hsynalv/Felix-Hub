/**
 * Sidecar terminal sandbox tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  execTerminalCommand,
  createTerminalSession,
  execInSession,
  resetTerminalSessionsForTests,
} from "../../src/plugins/local-sidecar/terminal.core.js";

describe("Sidecar terminal", () => {
  beforeEach(() => {
    resetTerminalSessionsForTests();
  });

  it("runs allowlisted command", async () => {
    const result = await execTerminalCommand(process.platform === "win32" ? "echo hello" : "echo hello");
    expect(result.ok).toBe(true);
    expect(result.data.stdout).toContain("hello");
  });

  it("blocks dangerous command", async () => {
    const result = await execTerminalCommand("sudo rm -rf /");
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("command_blocked");
  });

  it("executes in session", async () => {
    const session = createTerminalSession({ cwd: process.cwd() });
    const result = await execInSession(session.id, process.platform === "win32" ? "echo sess" : "echo sess");
    expect(result.ok).toBe(true);
    expect(result.data.stdout).toContain("sess");
  });
});
