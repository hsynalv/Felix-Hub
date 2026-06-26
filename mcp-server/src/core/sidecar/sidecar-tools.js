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
  delegateDesktopScreenshot,
  delegateDesktopActiveWindow,
  delegateDesktopOcr,
  delegateDesktopClick,
  delegateDesktopType,
  sidecarRequiredError,
} from "./sidecar-proxy.js";
import { execTerminalCommand } from "../../plugins/local-sidecar/terminal.core.js";
import { sendDesktopNotification } from "../../plugins/local-sidecar/notify.core.js";
import {
  captureScreenshot,
  getActiveWindow,
  ocrScreenRegion,
  desktopClick,
  desktopType,
} from "../../plugins/local-sidecar/desktop.core.js";

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

  registerTool({
    name: "desktop_screenshot",
    description: "Capture the local screen via paired sidecar (observe-only)",
    plugin: "local-sidecar",
    tags: [ToolTags.READ_ONLY, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["png", "jpg"], description: "Image format" },
      },
    },
    handler: async ({ format }) => {
      if (!isLocalFsOnServer()) {
        return (await delegateDesktopScreenshot({ format })) || sidecarRequiredError();
      }
      return captureScreenshot({ format });
    },
  });

  registerTool({
    name: "desktop_active_window",
    description: "Get the frontmost application and window title on the local machine",
    plugin: "local-sidecar",
    tags: [ToolTags.READ_ONLY, ToolTags.LOCAL_FS],
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      if (!isLocalFsOnServer()) {
        return (await delegateDesktopActiveWindow()) || sidecarRequiredError();
      }
      return getActiveWindow();
    },
  });

  registerTool({
    name: "desktop_ocr",
    description: "OCR text from a screenshot image (base64 from desktop_screenshot)",
    plugin: "local-sidecar",
    tags: [ToolTags.READ_ONLY, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        imageBase64: { type: "string", description: "PNG/JPEG base64 payload" },
      },
      required: ["imageBase64"],
    },
    handler: async ({ imageBase64 }) => {
      if (!isLocalFsOnServer()) {
        return (await delegateDesktopOcr({ imageBase64 })) || sidecarRequiredError();
      }
      return ocrScreenRegion({ imageBase64 });
    },
  });

  registerTool({
    name: "desktop_click",
    description: "Click at screen coordinates (requires approval; local sidecar only)",
    plugin: "local-sidecar",
    tags: [ToolTags.WRITE, ToolTags.NEEDS_APPROVAL, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        button: { type: "string", enum: ["left", "right", "middle"] },
        explanation: { type: "string" },
      },
      required: ["x", "y", "explanation"],
    },
    handler: async ({ x, y, button, explanation }) => {
      if (!isLocalFsOnServer()) {
        const r = await delegateDesktopClick({ x, y, button });
        return r ? { ...r, data: r.data ? { ...r.data, explanation } : undefined } : sidecarRequiredError();
      }
      const result = await desktopClick({ x, y, button });
      return result.ok ? { ok: true, data: { ...result.data, explanation } } : result;
    },
  });

  registerTool({
    name: "desktop_type",
    description: "Type text into the focused window (requires approval; local sidecar only)",
    plugin: "local-sidecar",
    tags: [ToolTags.WRITE, ToolTags.NEEDS_APPROVAL, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["text", "explanation"],
    },
    handler: async ({ text, explanation }) => {
      if (!isLocalFsOnServer()) {
        const r = await delegateDesktopType({ text });
        return r ? { ...r, data: r.data ? { ...r.data, explanation } : undefined } : sidecarRequiredError();
      }
      const result = await desktopType({ text });
      return result.ok ? { ok: true, data: { ...result.data, explanation } } : result;
    },
  });
}
