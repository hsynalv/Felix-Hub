/**
 * Notifications Plugin
 *
 * Native OS notifications (macOS/Linux/Windows) + Telegram channel.
 */

import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { requireScope } from "../../core/auth.js";
import { mountPluginHealth } from "../../core/plugin-health.js";
import { ToolTags } from "../../core/tool-registry.js";
import {
  getOS,
  listAvailableChannels,
  sendViaChannel,
  isTelegramConfigured,
  isNativeSupported,
} from "./channels/index.js";

const execAsync = promisify(exec);

const notificationHistory = [];
const MAX_HISTORY = 50;

function recordHistory(entry) {
  notificationHistory.unshift(entry);
  if (notificationHistory.length > MAX_HISTORY) {
    notificationHistory.pop();
  }
}

async function showNotification(options) {
  const { title, message, sound = false, subtitle, channel = "native" } = options;

  if (!title || !message) {
    throw new Error("Title and message are required");
  }

  const result = await sendViaChannel(channel, {
    title,
    message,
    sound,
    subtitle,
    nativeShow: showNativeNotification,
  });

  const notification = {
    id: `notif_${Date.now()}`,
    title,
    message,
    channel: result.resolvedChannel || channel,
    os: getOS(),
    timestamp: new Date().toISOString(),
    sound,
  };
  recordHistory(notification);

  return { success: true, channel: notification.channel, os: getOS() };
}

async function showNativeNotification(options) {
  const { title, message, sound = false, subtitle } = options;
  const os = getOS();
  let command;

  switch (os) {
    case "macos": {
      const soundArg = sound ? 'sound name "default"' : "";
      command = `osascript -e 'display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" ${subtitle ? `subtitle "${subtitle.replace(/"/g, '\\"')}"` : ""} ${soundArg}'`;
      break;
    }
    case "linux": {
      const icon = sound ? "dialog-information" : "dialog-info";
      command = `notify-send "${title.replace(/"/g, '\\"')}" "${message.replace(/"/g, '\\"')}" --icon=${icon} ${sound ? "--urgency=critical" : ""}`;
      break;
    }
    case "windows":
      command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')"`;
      break;
    default:
      throw new Error(`Notifications not supported on ${os}`);
  }

  await execAsync(command);
  return { success: true, os };
}

async function playSound(soundName = "default") {
  const os = getOS();
  let command;

  switch (os) {
    case "macos":
      command = `afplay /System/Library/Sounds/${soundName}.aiff`;
      break;
    case "linux":
      command = `paplay /usr/share/sounds/freedesktop/stereo/${soundName}.ogg || beep`;
      break;
    case "windows":
      command = `powershell -c (New-Object Media.SoundPlayer "C:\\Windows\\Media\\${soundName}.wav").PlaySync()`;
      break;
    default:
      throw new Error(`Sounds not supported on ${os}`);
  }

  try {
    await execAsync(command);
    return { success: true, os, sound: soundName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getHistory(limit = 20) {
  return notificationHistory.slice(0, Math.min(limit, MAX_HISTORY));
}

async function notifyTaskComplete(taskName, summary, projectName = null) {
  const title = projectName
    ? `✅ ${projectName}: ${taskName}`
    : `✅ Task Complete: ${taskName}`;

  return showNotification({
    title,
    message: summary.substring(0, 100),
    sound: true,
    channel: "auto",
  });
}

async function notifyError(error, context = null) {
  return showNotification({
    title: `❌ Error${context ? `: ${context}` : ""}`,
    message: typeof error === "string" ? error : error.message,
    sound: true,
    channel: "auto",
  });
}

async function sendUnifiedNotification(args) {
  const { channel = "auto", title, message, sound = false, parseMode } = args;
  if (!title || !message) {
    throw new Error("Title and message are required");
  }

  const result = await sendViaChannel(channel, {
    title,
    message,
    sound,
    parseMode: parseMode || null,
    nativeShow: showNativeNotification,
  });

  recordHistory({
    id: `notif_${Date.now()}`,
    title,
    message,
    channel: result.resolvedChannel || channel,
    os: getOS(),
    timestamp: new Date().toISOString(),
    sound,
  });

  return result;
}

// ── Plugin exports ───────────────────────────────────────────────────────────

export const name = "notifications";
export const version = "1.1.0";
export const description = "System notifications (native + Telegram)";
export const capabilities = ["read", "write"];
export const requires = [];
export const endpoints = [
  { method: "GET", path: "/notifications/health", description: "Plugin health", scope: "read" },
  { method: "POST", path: "/notifications/show", description: "Show a system notification", scope: "write" },
  { method: "POST", path: "/notifications/send", description: "Send via native, telegram, or auto", scope: "write" },
  { method: "GET", path: "/notifications/channels", description: "List notification channels", scope: "read" },
  { method: "POST", path: "/notifications/sound", description: "Play system sound", scope: "write" },
  { method: "GET", path: "/notifications/history", description: "Get notification history", scope: "read" },
  { method: "GET", path: "/notifications/os", description: "Get OS info", scope: "read" },
  { method: "POST", path: "/notifications/telegram/webhook", description: "Telegram bot webhook", scope: "public" },
];
export const examples = [
  'POST /notifications/show  body: {"title":"Done","message":"Task completed"}',
  'POST /notifications/send  body: {"channel":"telegram","title":"Alert","message":"Hello"}',
  'GET /notifications/channels',
];

export const tools = [
  {
    name: "notifications_send",
    description: "Send a notification via native OS, Telegram, or auto-detect channel",
    tags: [ToolTags.WRITE, ToolTags.NETWORK],
    inputSchema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          enum: ["native", "telegram", "auto"],
          default: "auto",
          description: "Delivery channel",
        },
        explanation: { type: "string", description: "Why this notification is being sent" },
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification body" },
        sound: { type: "boolean", default: false, description: "Play sound (native only)" },
        parseMode: {
          type: "string",
          enum: ["MarkdownV2"],
          description: "Telegram parse mode (optional)",
        },
      },
      required: ["title", "message"],
    },
    handler: async (args) => {
      try {
        const result = await sendUnifiedNotification(args);
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: { code: "notification_failed", message: err.message } };
      }
    },
  },
  {
    name: "notification_show",
    description: "Show a system notification (native OS)",
    tags: [ToolTags.WRITE, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        message: { type: "string", description: "Notification message" },
        sound: { type: "boolean", default: false, description: "Play sound" },
        subtitle: { type: "string", description: "Subtitle (macOS only)" },
      },
      required: ["title", "message"],
    },
    handler: async (args) => {
      try {
        const result = await showNotification({ ...args, channel: "native" });
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: { code: "notification_failed", message: err.message } };
      }
    },
  },
  {
    name: "notification_sound",
    description: "Play a system sound",
    tags: [ToolTags.WRITE, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        sound: { type: "string", default: "default", description: "Sound name" },
      },
    },
    handler: async (args) => {
      const result = await playSound(args.sound);
      return { ok: true, data: result };
    },
  },
  {
    name: "notification_task_complete",
    description: "Notify about task completion",
    tags: [ToolTags.WRITE, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        taskName: { type: "string", description: "Task name" },
        summary: { type: "string", description: "Task summary" },
        projectName: { type: "string", description: "Project name" },
      },
      required: ["taskName", "summary"],
    },
    handler: async (args) => {
      try {
        const result = await notifyTaskComplete(args.taskName, args.summary, args.projectName);
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: { code: "notification_failed", message: err.message } };
      }
    },
  },
  {
    name: "notification_error",
    description: "Notify about an error",
    tags: [ToolTags.WRITE, ToolTags.LOCAL_FS],
    inputSchema: {
      type: "object",
      properties: {
        error: { type: "string", description: "Error message" },
        context: { type: "string", description: "Error context" },
      },
      required: ["error"],
    },
    handler: async (args) => {
      try {
        const result = await notifyError(args.error, args.context);
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: { code: "notification_failed", message: err.message } };
      }
    },
  },
  {
    name: "notification_history",
    description: "Get notification history",
    tags: [ToolTags.READ],
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
      },
    },
    handler: async (args) => {
      return { ok: true, data: { notifications: getHistory(args.limit || 20) } };
    },
  },
  {
    name: "notifications_list_channels",
    description: "List available notification channels and configuration status",
    tags: [ToolTags.READ],
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      return { ok: true, data: { channels: listAvailableChannels() } };
    },
  },
];

export async function register(app) {
  const router = Router();
  mountPluginHealth(router, { name, version });

  router.post("/show", requireScope("write"), async (req, res) => {
    try {
      const result = await showNotification({ ...req.body, channel: "native" });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "notification_failed", message: err.message } });
    }
  });

  router.post("/send", requireScope("write"), async (req, res) => {
    try {
      const result = await sendUnifiedNotification(req.body);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "notification_failed", message: err.message } });
    }
  });

  router.get("/channels", requireScope("read"), (_req, res) => {
    res.json({
      ok: true,
      data: {
        channels: listAvailableChannels(),
        telegramConfigured: isTelegramConfigured(),
        nativeSupported: isNativeSupported(),
      },
    });
  });

  router.post("/sound", requireScope("write"), async (req, res) => {
    const result = await playSound(req.body?.sound || "default");
    res.json({ ok: true, data: result });
  });

  router.get("/history", requireScope("read"), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    res.json({ ok: true, data: { notifications: getHistory(limit) } });
  });

  router.get("/os", requireScope("read"), (_req, res) => {
    res.json({
      ok: true,
      data: {
        os: getOS(),
        platform: process.platform,
        notificationsSupported: isNativeSupported(),
        telegramConfigured: isTelegramConfigured(),
      },
    });
  });

  app.use("/notifications", router);

  const { registerTelegramWebhook } = await import("./telegram.webhook.js");
  registerTelegramWebhook(app);
}
