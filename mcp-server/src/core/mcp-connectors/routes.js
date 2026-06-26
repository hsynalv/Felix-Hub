/**
 * External MCP connector REST API (admin).
 */

import { requireScope } from "../auth.js";
import {
  listConnectors,
  getConnector,
  createConnector,
  updateConnector,
  deleteConnector,
  recordConnectorHealth,
} from "./connector.service.js";
import {
  enableConnector,
  disableConnector,
  testConnectorConnection,
} from "./tool-bridge.js";

export const CONNECTOR_TEMPLATES = [
  {
    id: "tavily",
    displayName: "Tavily Search",
    slug: "tavily",
    command: "npx",
    args: ["-y", "mcp-remote", "https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"],
    envKeys: ["TAVILY_API_KEY"],
  },
  {
    id: "figma",
    displayName: "Figma",
    slug: "figma",
    command: "npx",
    args: ["-y", "figma-developer-mcp", "--stdio"],
    envKeys: ["FIGMA_API_KEY"],
  },
];

function actorFromReq(req) {
  return req.user?.sub || req.user?.email || "admin";
}

export function registerMcpConnectorRoutes(app) {
  app.get("/mcp-connectors/templates", requireScope("admin"), (_req, res) => {
    res.json({ ok: true, data: { templates: CONNECTOR_TEMPLATES } });
  });

  app.get("/mcp-connectors", requireScope("admin"), async (_req, res) => {
    try {
      const connectors = await listConnectors();
      res.json({ ok: true, data: { connectors } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "connector_list_failed", message: err.message },
      });
    }
  });

  app.post("/mcp-connectors", requireScope("admin"), async (req, res) => {
    try {
      const connector = await createConnector(req.body || {}, { actor: actorFromReq(req) });
      res.status(201).json({ ok: true, data: { connector } });
    } catch (err) {
      const status = err.code === "duplicate_slug" ? 409 : 400;
      res.status(status).json({
        ok: false,
        error: { code: err.code || "connector_create_failed", message: err.message },
      });
    }
  });

  app.put("/mcp-connectors/:id", requireScope("admin"), async (req, res) => {
    try {
      const connector = await updateConnector(req.params.id, req.body || {});
      if (!connector) {
        return res.status(404).json({
          ok: false,
          error: { code: "not_found", message: "Connector not found" },
        });
      }
      res.json({ ok: true, data: { connector } });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: { code: err.code || "connector_update_failed", message: err.message },
      });
    }
  });

  app.delete("/mcp-connectors/:id", requireScope("admin"), async (req, res) => {
    try {
      const connector = await getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({
          ok: false,
          error: { code: "not_found", message: "Connector not found" },
        });
      }
      if (connector.enabled) {
        await disableConnector(connector);
      }
      await deleteConnector(req.params.id);
      res.json({ ok: true, data: { deleted: true } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "connector_delete_failed", message: err.message },
      });
    }
  });

  app.post("/mcp-connectors/:id/test", requireScope("admin"), async (req, res) => {
    try {
      const connector = await getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({
          ok: false,
          error: { code: "not_found", message: "Connector not found" },
        });
      }
      const envOverrides = req.body?.envOverrides || {};
      const result = await testConnectorConnection(connector, { envOverrides });
      await recordConnectorHealth(connector.id, {
        ok: result.ok,
        toolCount: result.toolCount ?? null,
        error: result.error,
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "connector_test_failed", message: err.message },
      });
    }
  });

  app.post("/mcp-connectors/:id/enable", requireScope("admin"), async (req, res) => {
    try {
      const connector = await getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({
          ok: false,
          error: { code: "not_found", message: "Connector not found" },
        });
      }
      const result = await enableConnector(connector);
      const updated = await getConnector(connector.id);
      res.json({ ok: true, data: { connector: updated, ...result } });
    } catch (err) {
      res.status(503).json({
        ok: false,
        error: { code: "connector_enable_failed", message: err.message },
      });
    }
  });

  app.post("/mcp-connectors/:id/disable", requireScope("admin"), async (req, res) => {
    try {
      const connector = await getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({
          ok: false,
          error: { code: "not_found", message: "Connector not found" },
        });
      }
      await disableConnector(connector);
      const updated = await getConnector(connector.id);
      res.json({ ok: true, data: { connector: updated } });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: { code: "connector_disable_failed", message: err.message },
      });
    }
  });
}
