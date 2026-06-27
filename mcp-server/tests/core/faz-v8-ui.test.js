import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { installTempCacheDir, restoreCacheDir } from "../helpers/temp-cache-env.js";
import { updateSpecArtifact } from "../../src/core/spec/spec-session.service.js";
import { startSpecSession } from "../../src/core/spec/spec-session.service.js";
import {
  listImportDrafts,
  approveImportDraft,
  rejectImportDraft,
  runImportScan,
} from "../../src/core/v8/prompt-import.service.js";
import { loadPrompts } from "../../src/plugins/prompt-registry/prompts.store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = join(__dirname, "../fixtures/prompt-archive");

let tempCacheDir;

beforeAll(async () => {
  tempCacheDir = installTempCacheDir();
  await runImportScan(ARCHIVE, { providerFilter: "Kiro", maxFiles: 2 });
});

afterAll(() => {
  restoreCacheDir(tempCacheDir);
});

describe("V8 UI follow-up — spec artifact edit", () => {
  it("updates artifact via PUT flow", async () => {
    const session = await startSpecSession({ title: "Edit test", idea: "x" });
    const result = await updateSpecArtifact(session.id, "requirements", "# Req\n\n- [ ] A");
    expect(result.ok).toBe(true);
    expect(result.data.artifacts.requirements.content).toContain("Req");
  });
});

describe("V8 UI follow-up — import approve", () => {
  it("lists pending drafts after scan", async () => {
    const drafts = await listImportDrafts();
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it("approves a low-risk draft into registry", async () => {
    const drafts = await listImportDrafts();
    const target = drafts.find((d) => d.risk === "low") || drafts[0];
    if (!target) return;

    const result = await approveImportDraft(target.id, { actor: "test", force: target.risk !== "low" });
    expect(result.ok).toBe(true);

    const store = await loadPrompts();
    expect(store.prompts.some((p) => p.id === result.data.promptId)).toBe(true);
    expect(store.prompts.find((p) => p.id === result.data.promptId)?.provenance).toBeTruthy();
  });

  it("rejects a draft", async () => {
    await runImportScan(ARCHIVE, { providerFilter: "Kiro", maxFiles: 1 });
    const drafts = await listImportDrafts();
    const target = drafts[0];
    if (!target) return;
    const result = await rejectImportDraft(target.id, { actor: "test" });
    expect(result.ok).toBe(true);
    const after = await listImportDrafts();
    expect(after.find((d) => d.id === target.id)).toBeUndefined();
  });
});
