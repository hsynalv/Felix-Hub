/**
 * Lightweight HTML helpers for browser snapshot/extract (no DOM dependency).
 */

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripHtmlTags(html) {
  return decodeEntities(String(html).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveHref(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * @param {string} html
 * @param {string} [baseUrl]
 * @param {number} [maxLinks]
 */
export function extractLinksFromHtml(html, baseUrl = "", maxLinks = 100) {
  const links = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) && links.length < maxLinks) {
    const href = match[1].trim();
    if (href.startsWith("#") || href.startsWith("javascript:")) continue;
    const text = stripHtmlTags(match[2]).slice(0, 200);
    links.push({ href: resolveHref(href, baseUrl), text });
  }
  return links;
}

/**
 * @param {string} html
 * @param {number} [maxTables]
 */
export function extractTablesFromHtml(html, maxTables = 5) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(html)) && tables.length < maxTables) {
    const block = tableMatch[0];
    const rows = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(block)) && rows.length < 50) {
      const cells = [];
      const cellRe = /<t[dh][\s\S]*?>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[0])) && cells.length < 20) {
        cells.push(stripHtmlTags(cellMatch[1]));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push({ rowCount: rows.length, rows: rows.slice(0, 20) });
  }
  return tables;
}

/**
 * @param {string} html
 * @param {string} query
 * @param {number} [maxMatches]
 */
export function findTextInHtml(html, query, maxMatches = 20) {
  const text = stripHtmlTags(html);
  const q = String(query).trim();
  if (!q) return [];

  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const matches = [];
  let idx = 0;
  while (matches.length < maxMatches) {
    const found = lower.indexOf(needle, idx);
    if (found === -1) break;
    const start = Math.max(0, found - 40);
    const end = Math.min(text.length, found + q.length + 40);
    matches.push({ index: found, snippet: text.slice(start, end) });
    idx = found + q.length;
  }
  return matches;
}

/**
 * @param {string} html
 */
export function buildPageSnapshot(html, { url = "", title = "" } = {}) {
  const text = stripHtmlTags(html);
  const links = extractLinksFromHtml(html, url, 20);
  return {
    url,
    title,
    textLength: text.length,
    textPreview: text.slice(0, 2000),
    linkCount: links.length,
    linksPreview: links.slice(0, 10),
    hasForms: /<form\b/i.test(html),
    hasPasswordField: /type=["']password["']/i.test(html),
  };
}
