import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { installTempCacheDir, restoreCacheDir } from "../helpers/temp-cache-env.js";
import {
  startSpecSession,
  advanceSpecSession,
  getSpecSessionDetail,
} from "../../src/core/spec/spec-session.service.js";
import { parseTasksFromMarkdown, buildWorkflowDraftFromSpec } from "../../src/core/spec/spec-templates.js";
import { runPromptEvalSuite, PROMPT_VARIANTS } from "../../src/core/eval/prompt-eval.service.js";
import {
  listMarketplacePacks,
  resolveMarketplacePack,
  PROMPT_MARKETPLACE_CATALOG,
} from "../../src/core/chat/prompt-marketplace.js";
import {
  segmentPromptText,
  buildDraftFromFile,
  scanPromptArchive,
} from "../../src/core/chat/prompt-importer.js";
import { buildSystemPrompt } from "../../src/core/chat/chat-system-prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = join(__dirname, "../../../system-prompts-and-models-of-ai-tools");

let tempCacheDir;

beforeEach(() => {
  tempCacheDir = installTempCacheDir();
});

afterEach(() => {
  restoreCacheDir(tempCacheDir);
  tempCacheDir = null;
});

describe("V8 Faz C — spec workflow", () => {
  it("creates session and advances through artifacts", async () => {
    const session = await startSpecSession({
      title: "Notification system",
      idea: "Add push notifications for approvals",
    });
    expect(session.stage).toBe("requirements");

    const r1 = await advanceSpecSession(session.id, {
      content: "# Requirements\n\n## Acceptance criteria\n- [ ] User gets push",
    });
    expect(r1.ok).toBe(true);
    expect(r1.data.savedStage).toBe("requirements");
    expect(r1.data.nextStage).toBe("design");

    const r2 = await advanceSpecSession(session.id, { content: "# Design\n\n## Architecture\n- Hub → FCM" });
    expect(r2.data.nextStage).toBe("tasks");

    const r3 = await advanceSpecSession(session.id, {
      content: "# Tasks\n\n- [ ] Backend webhook\n- [ ] UI toggle",
    });
    expect(r3.data.nextStage).toBe("complete");
    expect(r3.data.workflowDraft?.taskCount).toBe(2);

    const detail = await getSpecSessionDetail(session.id);
    expect(detail.ok).toBe(true);
    expect(Object.keys(detail.data.artifacts)).toEqual(["requirements", "design", "tasks"]);
  });

  it("parses checkbox tasks for workflow draft", () => {
    const tasks = parseTasksFromMarkdown("- [ ] Alpha\n- [ ] Beta");
    expect(tasks).toHaveLength(2);
    const draft = buildWorkflowDraftFromSpec({
      id: "x",
      title: "T",
      artifacts: { tasks: { content: "- [ ] Ship it" } },
    });
    expect(draft.steps.length).toBe(1);
  });
});

describe("V8 Faz C — prompt eval", () => {
  it("scores at least 3 variants", () => {
    expect(PROMPT_VARIANTS.length).toBeGreaterThanOrEqual(3);
    const suite = runPromptEvalSuite();
    expect(suite.variants.length).toBeGreaterThanOrEqual(3);
    expect(suite.pass).toBe(true);
    expect(suite.summary.failed).toBe(0);
  });
});

describe("V8 Faz C — marketplace", () => {
  it("lists marketplace packs", () => {
    const packs = listMarketplacePacks();
    expect(packs.length).toBeGreaterThanOrEqual(6);
    expect(PROMPT_MARKETPLACE_CATALOG.some((p) => p.id === "felix-spec-kiro")).toBe(true);
  });

  it("applies focused coder overlay to system prompt", () => {
    const prompt = buildSystemPrompt("", {
      chatProfile: "code_editing",
      chatMode: "agent",
      marketplacePackId: "felix-coder-cursor",
    });
    expect(prompt).toContain("Focused coding discipline");
  });

  it("resolves pack settings", () => {
    const pack = resolveMarketplacePack("felix-desktop");
    expect(pack?.chatMode).toBe("desktop");
    expect(pack?.chatProfile).toBe("desktop_assistant");
  });
});

describe("V8 Faz C — prompt importer", () => {
  it("segments prompt headers", () => {
    const segs = segmentPromptText("# Identity\nYou are X\n\n# Rules\n- Never bypass");
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].sectionKey).toBe("identity");
  });

  it("builds draft with provenance from file", () => {
    const draft = buildDraftFromFile("Kiro/Spec_Prompt.txt", "# Identity\nTest\n\n# Rules\n- Be safe", "Kiro");
    expect(draft.provenance.sourceProvider).toBe("Kiro");
    expect(draft.provenance.risk).toBeDefined();
    expect(draft.sections.identity).toBeDefined();
  });

  it("scans Kiro archive samples", async () => {
    const drafts = await scanPromptArchive(ARCHIVE_DIR, { providerFilter: "Kiro", maxFiles: 3 });
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts.every((d) => d.provenance?.derivedAt)).toBe(true);
  });
});
