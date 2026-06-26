/**
 * V7 — RSS/Atom feed connector for daily briefing.
 */

import { patchRssFeedMeta } from "./briefing-source-store.js";

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(text) {
  if (!text) return "";
  const cdata = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const raw = cdata ? cdata[1] : text;
  return decodeEntities(raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? stripTags(m[1]) : null;
}

function extractLink(block) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (href) return href[1];
  const guid = extractTag(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return guid;
  const linkTag = extractTag(block, "link");
  if (linkTag && /^https?:\/\//i.test(linkTag)) return linkTag;
  return null;
}

/**
 * Minimal RSS 2.0 + Atom parser (no external deps).
 * @param {string} xml
 */
export function parseFeedXml(xml) {
  const items = [];
  const rssBlocks = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  for (const [, block] of rssBlocks) {
    const title = extractTag(block, "title");
    if (!title) continue;
    items.push({
      title,
      link: extractLink(block),
      body: extractTag(block, "description") || extractTag(block, "summary") || "",
      publishedAt: extractTag(block, "pubDate") || extractTag(block, "published") || null,
    });
  }

  if (!items.length) {
    const atomBlocks = [...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];
    for (const [, block] of atomBlocks) {
      const title = extractTag(block, "title");
      if (!title) continue;
      items.push({
        title,
        link: extractLink(block),
        body: extractTag(block, "summary") || extractTag(block, "content") || "",
        publishedAt: extractTag(block, "updated") || extractTag(block, "published") || null,
      });
    }
  }

  return items;
}

function parsePublishedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function scoreRssItem(item) {
  let score = 45;
  const published = item.publishedAt ? new Date(item.publishedAt) : null;
  if (published) {
    const ageHours = (Date.now() - published.getTime()) / (1000 * 60 * 60);
    if (ageHours < 6) score += 25;
    else if (ageHours < 24) score += 15;
    else if (ageHours > 72) score -= 10;
  }
  return score;
}

/**
 * @param {{ id: string, url: string, label?: string, etag?: string|null, lastModified?: string|null }} feed
 * @param {{ limit?: number, fetchImpl?: typeof fetch }} opts
 */
export async function fetchRssFeedItems(feed, { limit = 8, fetchImpl = fetch } = {}) {
  const headers = { "User-Agent": "mcp-hub-briefing/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" };
  if (feed.etag) headers["If-None-Match"] = feed.etag;
  if (feed.lastModified) headers["If-Modified-Since"] = feed.lastModified;

  const res = await fetchImpl(feed.url, { headers, signal: AbortSignal.timeout(15000) });

  if (res.status === 304) {
    patchRssFeedMeta(feed.id, { lastFetchedAt: new Date().toISOString(), lastError: null });
    return [];
  }

  if (!res.ok) {
    throw new Error(`RSS fetch failed: HTTP ${res.status}`);
  }

  const xml = await res.text();
  const parsed = parseFeedXml(xml).slice(0, limit);

  patchRssFeedMeta(feed.id, {
    etag: res.headers.get("etag") || feed.etag || null,
    lastModified: res.headers.get("last-modified") || feed.lastModified || null,
    lastFetchedAt: new Date().toISOString(),
    lastError: null,
    itemCount: parsed.length,
  });

  return parsed.map((item, idx) => {
    const publishedAt = parsePublishedAt(item.publishedAt);
    return {
      id: `rss:${feed.id}:${idx}`,
      source: "rss",
      sourceId: feed.id,
      sourceLabel: feed.label || feed.url,
      title: item.title,
      body: item.body.slice(0, 400),
      link: item.link,
      importance: scoreRssItem({ ...item, publishedAt }),
      actionRequired: false,
      href: item.link || null,
      createdAt: publishedAt || new Date().toISOString(),
      dedupKey: item.link || item.title.toLowerCase().trim(),
    };
  });
}
