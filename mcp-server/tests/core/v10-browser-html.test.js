import { describe, it, expect } from "vitest";
import {
  extractLinksFromHtml,
  extractTablesFromHtml,
  findTextInHtml,
  buildPageSnapshot,
} from "../../src/plugins/local-sidecar/browser-html.js";

const SAMPLE = `
<html><head><title>Test Shop</title></head>
<body>
  <a href="/products">Products</a>
  <a href="https://other.example/item">Item</a>
  <table><tr><th>Name</th><th>Price</th></tr><tr><td>Widget</td><td>9.99</td></tr></table>
  <p>Free shipping on all Widget orders today.</p>
</body></html>
`;

describe("v10 browser html", () => {
  it("extracts links", () => {
    const links = extractLinksFromHtml(SAMPLE, "https://shop.example.com");
    expect(links.length).toBe(2);
    expect(links[0].href).toBe("https://shop.example.com/products");
  });

  it("extracts tables", () => {
    const tables = extractTablesFromHtml(SAMPLE);
    expect(tables.length).toBe(1);
    expect(tables[0].rows[1]).toEqual(["Widget", "9.99"]);
  });

  it("finds text snippets", () => {
    const matches = findTextInHtml(SAMPLE, "Widget");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].snippet).toContain("Widget");
  });

  it("builds snapshot summary", () => {
    const snap = buildPageSnapshot(SAMPLE, { url: "https://shop.example.com", title: "Test Shop" });
    expect(snap.title).toBe("Test Shop");
    expect(snap.linkCount).toBe(2);
    expect(snap.textPreview).toContain("Free shipping");
  });
});
