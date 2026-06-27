import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  browserOpenUrl,
  browserSnapshot,
  browserExtractLinks,
  resetBrowserSessionForTests,
} from "../../src/plugins/local-sidecar/browser.core.js";

describe("v10 browser core", () => {
  let fetchMock;

  beforeEach(() => {
    resetBrowserSessionForTests();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/",
      arrayBuffer: async () =>
        new TextEncoder().encode(
          '<html><head><title>Example</title></head><body><a href="/about">About</a></body></html>'
        ).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("browser_open_url fetches and stores session", async () => {
    const r = await browserOpenUrl({ url: "https://example.com", usePlaywright: false });
    expect(r.ok).toBe(true);
    expect(r.data.title).toBe("Example");
    expect(r.data.engine).toBe("fetch");
  });

  it("browser_snapshot returns preview after open", async () => {
    await browserOpenUrl({ url: "https://example.com", usePlaywright: false });
    const snap = await browserSnapshot();
    expect(snap.ok).toBe(true);
    expect(snap.data.linkCount).toBeGreaterThan(0);
  });

  it("browser_extract_links returns anchors", async () => {
    await browserOpenUrl({ url: "https://example.com", usePlaywright: false });
    const links = await browserExtractLinks();
    expect(links.ok).toBe(true);
    expect(links.data.links[0].text).toBe("About");
  });
});
