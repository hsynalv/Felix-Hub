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

export function registerSidecarRoutes(app) {
  app.get("/sidecar/status", requireScope("read"), (_req, res) => {
    const devices = listSidecarDevices();
    res.json({
      ok: true,
      data: {
        localFsOnServer: isLocalFsOnServer(),
        delegateToSidecar: !isLocalFsOnServer(),
        deviceCount: devices.length,
        devices: devices.map((d) => ({
          id: d.id,
          name: d.name,
          baseUrl: d.baseUrl,
          pairedAt: d.pairedAt,
          lastSeenAt: d.lastSeenAt,
        })),
      },
    });
  });

  app.post("/sidecar/pairing/code", requireScope("admin"), (_req, res) => {
    const data = createPairingCode({ createdBy: "admin" });
    res.json({ ok: true, data });
  });

  app.post("/sidecar/pair", requireScope("write"), (req, res) => {
    const { code, deviceName, baseUrl, capabilities } = req.body ?? {};
    if (!code || !baseUrl) {
      return res.status(400).json({
        ok: false,
        error: { code: "invalid_request", message: "code and baseUrl required" },
      });
    }
    const result = consumePairingCode(String(code), {
      deviceName,
      baseUrl: String(baseUrl),
      capabilities,
    });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: { code: result.error, message: result.error } });
    }
    res.json({ ok: true, data: result.device, authToken: result.authToken });
  });

  app.delete("/sidecar/devices/:id", requireScope("admin"), (req, res) => {
    const removed = removeSidecarDevice(req.params.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: { code: "not_found" } });
    }
    res.json({ ok: true, deleted: req.params.id });
  });
}
