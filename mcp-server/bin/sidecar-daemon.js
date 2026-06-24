#!/usr/bin/env node
/**
 * MCP Hub local sidecar daemon — filesystem, terminal, desktop notify on localhost.
 *
 * Usage:
 *   npm run sidecar:daemon
 *   SIDECAR_AUTH_TOKEN=<from-pairing> npm run sidecar:daemon
 */

import express from "express";
import { fsList, fsRead, fsWrite, fsHash } from "../src/plugins/local-sidecar/sidecar.core.js";
import {
  createTerminalSession,
  execTerminalCommand,
  execInSession,
  closeTerminalSession,
  listTerminalSessions,
} from "../src/plugins/local-sidecar/terminal.core.js";
import { sendDesktopNotification } from "../src/plugins/local-sidecar/notify.core.js";
import { validateSidecarRequest } from "../src/core/sidecar/sidecar-auth.js";

const port = Number(process.env.SIDECAR_PORT || 9477);
const authToken = process.env.SIDECAR_AUTH_TOKEN || "";
const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!validateSidecarRequest(req, authToken)) {
    return res.status(401).json({ ok: false, error: { code: "unauthorized", message: "Invalid sidecar token" } });
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    service: "mcp-hub-sidecar",
    authRequired: Boolean(authToken),
    capabilities: ["fs", "terminal", "notify"],
  });
});

app.get("/fs/list", async (req, res) => {
  res.json(await fsList(req.query.path || "."));
});

app.get("/fs/read", async (req, res) => {
  if (!req.query.path) return res.status(400).json({ ok: false, error: "path required" });
  res.json(await fsRead(req.query.path, { maxSize: parseInt(req.query.maxSize, 10) || 1048576 }));
});

app.post("/fs/write", async (req, res) => {
  const { path, content } = req.body || {};
  if (!path || content === undefined) {
    return res.status(400).json({ ok: false, error: "path and content required" });
  }
  res.json(await fsWrite(path, content));
});

app.get("/fs/hash", async (req, res) => {
  if (!req.query.path) return res.status(400).json({ ok: false, error: "path required" });
  res.json(await fsHash(req.query.path));
});

app.post("/terminal/sessions", (req, res) => {
  const session = createTerminalSession({ cwd: req.body?.cwd || process.cwd() });
  res.json({ ok: true, data: session });
});

app.get("/terminal/sessions", (_req, res) => {
  res.json({ ok: true, data: { sessions: listTerminalSessions() } });
});

app.post("/terminal/sessions/:id/exec", async (req, res) => {
  const result = await execInSession(req.params.id, req.body?.command, {
    timeoutMs: req.body?.timeoutMs || 30_000,
  });
  res.json(result);
});

app.delete("/terminal/sessions/:id", (req, res) => {
  const removed = closeTerminalSession(req.params.id);
  res.json({ ok: removed, deleted: removed ? req.params.id : null });
});

app.post("/terminal/exec", async (req, res) => {
  const result = await execTerminalCommand(req.body?.command, {
    cwd: req.body?.cwd,
    timeoutMs: req.body?.timeoutMs || 30_000,
  });
  res.json(result);
});

app.post("/notify", async (req, res) => {
  res.json(await sendDesktopNotification(req.body || {}));
});

app.listen(port, "127.0.0.1", () => {
  console.log(`[sidecar] listening on http://127.0.0.1:${port}`);
  console.log(`[sidecar] auth: ${authToken ? "enabled (SIDECAR_AUTH_TOKEN set)" : "disabled (dev only)"}`);
  console.log(`[sidecar] Pair baseUrl=http://127.0.0.1:${port}`);
});
