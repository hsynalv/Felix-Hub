/**
 * Shell safe vs power mode matrix.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getShellMode,
  getShellAllowlistSet,
  checkSafeModeOperators,
  shellSessionsEnabled,
  shellBackgroundEnabled,
} from "../../src/plugins/shell/shell-config.js";

describe("shell modes", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("defaults to safe in production when SHELL_MODE unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SHELL_MODE;
    expect(getShellMode()).toBe("safe");
  });

  it("safe mode blocks curl and python in allowlist", () => {
    process.env.SHELL_MODE = "safe";
    const list = getShellAllowlistSet();
    expect(list.has("ls")).toBe(true);
    expect(list.has("curl")).toBe(false);
    expect(list.has("python")).toBe(false);
    expect(list.has("env")).toBe(false);
  });

  it("power mode allows curl and python", () => {
    process.env.SHELL_MODE = "power";
    const list = getShellAllowlistSet();
    expect(list.has("curl")).toBe(true);
    expect(list.has("python")).toBe(true);
  });

  it("safe mode blocks shell operators", () => {
    process.env.SHELL_MODE = "safe";
    expect(checkSafeModeOperators("ls | grep x")).toMatch(/blocked/i);
    expect(checkSafeModeOperators("ls && rm -rf /")).toMatch(/blocked/i);
    expect(checkSafeModeOperators("ls")).toBeNull();
  });

  it("power mode allows operators at config layer", () => {
    process.env.SHELL_MODE = "power";
    expect(checkSafeModeOperators("ls | grep x")).toBeNull();
  });

  it("sessions and background disabled in safe mode", () => {
    process.env.SHELL_MODE = "safe";
    expect(shellSessionsEnabled()).toBe(false);
    expect(shellBackgroundEnabled()).toBe(false);
  });

  it("sessions enabled in power mode", () => {
    process.env.SHELL_MODE = "power";
    expect(shellSessionsEnabled()).toBe(true);
    expect(shellBackgroundEnabled()).toBe(true);
  });
});
