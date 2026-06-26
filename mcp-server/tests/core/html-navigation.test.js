import { describe, expect, it } from "vitest";
import { wantsHtmlNavigation } from "../../src/core/http/html-navigation.js";

describe("wantsHtmlNavigation", () => {
  it("detects browser navigations", () => {
    expect(
      wantsHtmlNavigation({
        headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      })
    ).toBe(true);
  });

  it("detects JSON API fetches", () => {
    expect(
      wantsHtmlNavigation({
        headers: { accept: "application/json" },
      })
    ).toBe(false);
  });
});
