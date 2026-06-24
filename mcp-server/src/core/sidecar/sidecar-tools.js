/**
 * MCP tools for local sidecar — terminal + desktop notify.
 */

import { registerTool, ToolTags } from "../tool-registry.js";
import { isLocalFsOnServer } from "./pairing.service.js";
import {
  delegateTerminalExec,
  delegateTerminalSessionCreate,
  delegateTerminalSessionExec,
  delegateNotify,
  sidecarRequiredError,
} from "./sidecar-proxy.js";
import { execTerminalCommand } from "../../plugins/local-sidecar/terminal.core.js";
import { sendDesktopNotification } from "../../plugins/local-sidecar/notify.core.js";

export function registerSidecarTools() {
  registerTool({
    name: "local_terminal_exec",
    description: "Execute an allowlisted shell command on the paired local sidecar (or server in dev)",
    plugin: "local-sidecar",
    tags: [ToolTags.WRITE, ToolTags.NEEDS_APPROVAL, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["command", "explanation"],
    },
    handler: async ({ command, cwd, explanation }) => {
      if (!isLocalFsOnServer()) {
        const delegated = await delegateTerminalExec(command, { cwd });
        if (delegated) return { ...delegated, data: { ...delegated.data, explanation } };
        return sidecarRequiredError();
      }
      const result = await execTerminalCommand(command, { cwd });
      return result.ok
        ? { ok: true, data: { ...result.data, explanation } }
        : result;
    },
  });

  registerTool({
    name: "local_terminal_session_create",
    description: "Create a named terminal session on the local sidecar",
    plugin: "local-sidecar",
    tags: [ToolTags.WRITE, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: { cwd: { type: "string" } },
    },
    handler: async ({ cwd }) => {
      if (!isLocalFsOnServer()) {
        return (await delegateTerminalSessionCreate(cwd)) || sidecarRequiredError();
      }
      const { createTerminalSession } = await import("../../plugins/local-sidecar/terminal.core.js");
      return { ok: true, data: createTerminalSession({ cwd }) };
    },
  });

  registerTool({
    name: "local_terminal_session_exec",
    description: "Run command in an existing sidecar terminal session",
    plugin: "local-sidecar",
    tags: [ToolTags.WRITE, ToolTags.NEEDS_APPROVAL, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        command: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["sessionId", "command", "explanation"],
    },
    handler: async ({ sessionId, command, explanation }) => {
      if (!isLocalFsOnServer()) {
        const r = await delegateTerminalSessionExec(sessionId, command);
        return r ? { ...r, data: r.data ? { ...r.data, explanation } : undefined } : sidecarRequiredError();
      }
      const { execInSession } = await import("../../plugins/local-sidecar/terminal.core.js");
      const result = await execInSession(sessionId, command);
      return result.ok ? { ok: true, data: { ...result.data, explanation } } : result;
    },
  });

  registerTool({
    name: "local_notify",
    description: "Send a desktop notification via the paired local sidecar",
    plugin: "local-sidecar",
    tags: [ToolTags.READ_ONLY, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        message: { type: "string" },
      },
      required: ["message"],
    },
    handler: async ({ title, message }) => {
      if (!isLocalFsOnServer()) {
        return (await delegateNotify({ title, message })) || sidecarRequiredError();
      }
      return sendDesktopNotification({ title, message });
    },
  });
}
