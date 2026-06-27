/**
 * V8 HTTP routes — marketplace, prompt import review.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { requireScope } from "../auth.js";
import { listMarketplacePacks, resolveMarketplacePack } from "../chat/prompt-marketplace.js";
import {
  listImportDrafts,
  getImportDraft,
  approveImportDraft,
  rejectImportDraft,
  runImportScan,
} from "./prompt-import.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARCHIVE = join(__dirname, "../../../../system-prompts-and-models-of-ai-tools");

export function registerV8Routes(app) {
  app.get("/v8/prompt-marketplace", requireScope("read"), (_req, res) => {
    res.json({ ok: true, data: { packs: listMarketplacePacks() } });
  });

  app.get("/v8/prompt-marketplace/:id", requireScope("read"), (req, res) => {
    const pack = resolveMarketplacePack(req.params.id);
    if (!pack) {
      return res.status(404).json({ ok: false, error: { code: "not_found", message: "Pack not found" } });
    }
    res.json({ ok: true, data: pack });
  });

  app.get("/v8/prompt-import/drafts", requireScope("read"), async (_req, res) => {
    try {
      const drafts = await listImportDrafts();
      res.json({ ok: true, data: { drafts, count: drafts.length } });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "draft_list_failed", message: err.message } });
    }
  });

  app.get("/v8/prompt-import/drafts/:id", requireScope("read"), async (req, res) => {
    try {
      const result = await getImportDraft(req.params.id);
      res.status(result.ok ? 200 : 404).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "draft_get_failed", message: err.message } });
    }
  });

  app.post("/v8/prompt-import/scan", requireScope("write"), async (req, res) => {
    try {
      const source = req.body?.source || DEFAULT_ARCHIVE;
      const result = await runImportScan(source, {
        providerFilter: req.body?.provider,
        maxFiles: req.body?.maxFiles ?? 30,
      });
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "import_scan_failed", message: err.message } });
    }
  });

  app.post("/v8/prompt-import/drafts/:id/approve", requireScope("write"), async (req, res) => {
    try {
      const result = await approveImportDraft(req.params.id, {
        force: req.body?.force === true,
        actor: req.user?.sub || "admin",
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "import_approve_failed", message: err.message } });
    }
  });

  app.post("/v8/prompt-import/drafts/:id/reject", requireScope("write"), async (req, res) => {
    try {
      const result = await rejectImportDraft(req.params.id, {
        actor: req.user?.sub || "admin",
        reason: req.body?.reason,
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: { code: "import_reject_failed", message: err.message } });
    }
  });
}
