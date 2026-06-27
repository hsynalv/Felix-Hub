/**
 * Sidecar terminal sandbox tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  execTerminalCommand,
  createTerminalSession,
  execInSession,
  resetTerminalSessionsForTests,
} from "../../src/plugins/local-sidecar/terminal.core.js";
import { resetSidecarTerminalConfigForTests } from "../../src/plugins/local-sidecar/sidecar-terminal-config.js";

describe("Sidecar terminal", () => {
  beforeEach(() => {
    resetTerminalSessionsForTests();
    resetSidecarTerminalConfigForTests();
    process.env.SIDECAR_TERMINAL_MODE = "safe";
  });

  afterEach(() => {
    resetSidecarTerminalConfigForTests();
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

  it("blocks npm in safe mode", async () => {
    const result = await execTerminalCommand("npm test");
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("command_blocked");
    expect(result.error.message).toContain("npm");
  });

  it("executes in session", async () => {
    const session = createTerminalSession({ cwd: process.cwd() });
    const result = await execInSession(session.id, process.platform === "win32" ? "echo sess" : "echo sess");
    expect(result.ok).toBe(true);
    expect(result.data.stdout).toContain("sess");
  });
});
