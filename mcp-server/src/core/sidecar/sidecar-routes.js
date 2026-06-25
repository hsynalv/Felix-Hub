/**
 * Sidecar pairing and device management routes.
 */

import { requireScope } from "../auth.js";
import {
  createPairingCode,
  consumePairingCode,
  listSidecarDevices,
  removeSidecarDevice,
  isLocalFsOnServer,
} from "./pairing.service.js";

async function probeDeviceHealth(device) {
  try {
    const headers = { Accept: "application/json" };
    if (device.authToken) headers.Authorization = `Bearer ${device.authToken}`;
    const res = await fetch(`${device.baseUrl}/health`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { online: false, error: `HTTP ${res.status}` };
    const body = await res.json().catch(() => ({}));
    return { online: true, health: body };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

function resolveAggregateStatus({ delegateToSidecar, devices }) {
  if (!delegateToSidecar) return "not_required";
  if (!devices.length) return "no_device";
  if (devices.some((d) => d.online)) return "connected";
  return "offline";
}

export async function getSidecarStatusPayload() {
  const localFsOnServer = isLocalFsOnServer();
  const delegateToSidecar = !localFsOnServer;
  const raw = await listSidecarDevices();
  const devices = await Promise.all(
    raw.map(async (d) => {
      const probe = await probeDeviceHealth(d);
      return {
        id: d.id,
        name: d.name,
        baseUrl: d.baseUrl,
        capabilities: d.capabilities || ["fs"],
        pairedAt: d.pairedAt,
        lastSeenAt: d.lastSeenAt,
        online: probe.online,
        health: probe.health || null,
        error: probe.error || null,
      };
    })
  );

  const aggregateStatus = resolveAggregateStatus({ delegateToSidecar, devices });

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    localFsOnServer,
    delegateToSidecar,
    mode: localFsOnServer ? "direct" : "delegated",
    deviceCount: devices.length,
    devices,
    aggregateStatus,
    sidecarRequired: delegateToSidecar,
    ready: !delegateToSidecar || aggregateStatus === "connected",
  };
}

export function registerSidecarRoutes(app) {
  app.get("/sidecar/status", requireScope("read"), async (_req, res) => {
    try {
      const data = await getSidecarStatusPayload();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "status_failed", message: err.message } });
    }
  });

  app.post("/sidecar/pairing/code", requireScope("admin"), (_req, res) => {
    const data = createPairingCode({ createdBy: "admin" });
    res.json({ ok: true, data });
  });

  app.post("/sidecar/pair", requireScope("write"), async (req, res) => {
    const { code, deviceName, baseUrl, capabilities } = req.body ?? {};
    if (!code || !baseUrl) {
      return res.status(400).json({
        ok: false,
        error: { code: "invalid_request", message: "code and baseUrl required" },
      });
    }
    const result = await consumePairingCode(String(code), {
      deviceName,
      baseUrl: String(baseUrl),
      capabilities,
    });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: { code: result.error, message: result.error } });
    }
    res.json({
      ok: true,
      data: {
        ...result.device,
        authToken: result.authToken,
      },
    });
  });

  app.delete("/sidecar/devices/:id", requireScope("admin"), async (req, res) => {
    const removed = await removeSidecarDevice(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, deleted: req.params.id });
  });
}
