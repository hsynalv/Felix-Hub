import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installTempCacheDir, restoreCacheDir } from "../helpers/temp-cache-env.js";
import { buildSystemPrompt } from "../../src/core/chat/chat-system-prompt.js";
import { BRAND } from "../../src/core/branding.js";
import { CHAT_MODES } from "../../src/core/chat/prompt-constants.js";
import { renderChatPrompt, assembleSections } from "../../src/core/chat/chat-prompt-render.js";
import { FELIX_DEFAULT_BUNDLE } from "../../src/core/chat/prompt-bundles/felix-default.js";
import { resolveChatProfile, resolvePromptRender } from "../../src/core/chat/chat-profiles.js";
import { validateProvenance } from "../../src/core/chat/provenance.js";
import { ensureBuiltinPrompts } from "../../src/plugins/prompt-registry/prompts.seed.js";
import { loadPrompts } from "../../src/plugins/prompt-registry/prompts.store.js";

let tempCacheDir;

beforeEach(() => {
  tempCacheDir = installTempCacheDir();
});

afterEach(() => {
  restoreCacheDir(tempCacheDir);
});

describe("V8 Faz A — prompt registry", () => {
  it("defines 7 chat modes including ops and desktop", () => {
    expect(CHAT_MODES).toEqual(["chat", "agent", "spec", "review", "debug", "ops", "desktop"]);
  });

  it("felix-default bundle has provenance and core sections", () => {
    expect(FELIX_DEFAULT_BUNDLE.id).toBe("felix-default");
    expect(validateProvenance(FELIX_DEFAULT_BUNDLE.provenance).ok).toBe(true);
    expect(FELIX_DEFAULT_BUNDLE.sections.identity).toContain(BRAND.assistantName);
    expect(FELIX_DEFAULT_BUNDLE.sections.tool_calling).toContain("Read before write");
  });

  it("renderChatPrompt applies mode overlays", () => {
    const spec = renderChatPrompt({ mode: "spec" });
    expect(spec).toContain("Mode: spec");
    expect(spec).toContain("requirements.md");
    const desktop = renderChatPrompt({ mode: "desktop" });
    expect(desktop).toContain(BRAND.desktopAgentName);
  });

  it("profiles map to mode and bundle", () => {
    expect(resolvePromptRender({ chatProfile: "automation" }).mode).toBe("ops");
    expect(resolvePromptRender({ chatProfile: "spec_planner" }).mode).toBe("spec");
    expect(resolveChatProfile("desktop_assistant").mode).toBe("desktop");
  });

  it("chatMode override wins over profile mode", () => {
    expect(resolvePromptRender({ chatProfile: "balanced", chatMode: "review" }).mode).toBe("review");
  });

  it("buildSystemPrompt uses registry render by default", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(BRAND.assistantName);
    expect(prompt).toContain("Read before write");
    expect(prompt).toContain("Mode: agent");
  });

  it("spec profile prompt includes spec sections", () => {
    const prompt = buildSystemPrompt("", { chatProfile: "spec_planner" });
    expect(prompt).toContain("tasks.md");
  });

  it("telegram channel rules still appended", () => {
    const prompt = buildSystemPrompt("", { channel: "telegram" });
    expect(prompt).toContain("tavily__tavily_search");
  });

  it("seeds felix-default into prompt store idempotently", async () => {
    const first = await ensureBuiltinPrompts();
    const second = await ensureBuiltinPrompts();
    expect(first.seeded || !second.seeded).toBe(true);
    const data = await loadPrompts();
    const found = data.prompts.find((p) => p.id === "felix-default");
    expect(found?.name).toBe("Felix Default");
    expect(found?.provenance?.risk).toBe("low");
  });

  it("assembleSections preserves standard order", () => {
    const text = assembleSections({
      tool_calling: "tools",
      identity: "id",
      flow: "flow",
    });
    expect(text.indexOf("id")).toBeLessThan(text.indexOf("flow"));
    expect(text.indexOf("flow")).toBeLessThan(text.indexOf("tools"));
  });
});
