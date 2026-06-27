/**
 * Sidecar terminal sessions — sandboxed command execution on local machine.
 */

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import {
  getSidecarTerminalAllowlistSet,
  checkSidecarSafeModeOperators,
  isSidecarPowerCommand,
  getSidecarTerminalMode,
} from "./sidecar-terminal-config.js";

const BLOCKED_PATTERNS = [
  /\brm\s+.*-[rf]*r/i,
  /\bsudo\b/i,
  /\bcurl\b.*\|\s*\bbash\b/i,
  /\$\(/,
  /`/,
  /\beval\b/i,
];

/** @type {Map<string, { id: string, cwd: string, createdAt: string }>} */
const sessions = new Map();

function validateCommand(command) {
  const trimmed = String(command || "").trim();
  if (!trimmed) return { ok: false, error: "empty command" };
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(trimmed)) return { ok: false, error: "command blocked by policy" };
  }
  const operatorErr = checkSidecarSafeModeOperators(trimmed);
  if (operatorErr) return { ok: false, error: operatorErr };

  const first = trimmed.split(/\s+/)[0].replace(/^.*\//, "").toLowerCase();
  const allowlist = getSidecarTerminalAllowlistSet();
  if (!allowlist.has(first)) {
    const mode = getSidecarTerminalMode();
    const hint =
      mode === "safe" && isSidecarPowerCommand(trimmed)
        ? ` (blocked in safe mode; power commands need SIDECAR_TERMINAL_MODE=power + admin approval)`
        : "";
    return { ok: false, error: `command not in allowlist: ${first}${hint}` };
  }
  return { ok: true, command: trimmed };
}

export function createTerminalSession({ cwd = process.cwd() } = {}) {
  const session = {
    id: randomUUID(),
    cwd,
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getTerminalSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function closeTerminalSession(sessionId) {
  return sessions.delete(sessionId);
}

export function listTerminalSessions() {
  return [...sessions.values()];
}

export function resetTerminalSessionsForTests() {
  sessions.clear();
}

export function execTerminalCommand(command, { cwd = process.cwd(), timeoutMs = 30_000, maxOutput = 100_000 } = {}) {
  const check = validateCommand(command);
  if (!check.ok) {
    return Promise.resolve({ ok: false, error: { code: "command_blocked", message: check.error } });
  }

  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(check.command, { shell: true, cwd, env: process.env });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        error: { code: "timeout", message: `Command timed out after ${timeoutMs}ms` },
        stdout: stdout.slice(0, maxOutput),
        stderr: stderr.slice(0, maxOutput),
        durationMs: Date.now() - start,
      });
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > maxOutput) stdout = stdout.slice(0, maxOutput);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > maxOutput) stderr = stderr.slice(0, maxOutput);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        data: {
          command: check.command,
          cwd,
          exitCode: code,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          mode: getSidecarTerminalMode(),
        },
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: { code: "spawn_error", message: err.message } });
    });
  });
}

export async function execInSession(sessionId, command, opts = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    return { ok: false, error: { code: "session_not_found", message: "Terminal session not found" } };
  }
  return execTerminalCommand(command, { cwd: session.cwd, ...opts });
}
