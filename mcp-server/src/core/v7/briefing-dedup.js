/**
 * V7 — Cross-source briefing item deduplication.
 */

function stripTrackingParams(url) {
  try {
    const u = new URL(url);
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const p of drop) u.searchParams.delete(p);
    u.hash = "";
    return `${u.hostname}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return null;
  }
}

export function normalizeBriefingTitle(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function buildDedupKeys(item) {
  const keys = new Set();
  if (item.dedupKey) keys.add(String(item.dedupKey).toLowerCase().trim());
  if (item.link) {
    const urlKey = stripTrackingParams(item.link);
    if (urlKey) keys.add(`url:${urlKey}`);
  }
  const titleKey = normalizeBriefingTitle(item.title);
  if (titleKey.length >= 12) keys.add(`title:${titleKey}`);
  return [...keys];
}

/**
 * Merge duplicate stories across RSS/IMAP/Gmail; keep highest importance.
 * @param {Array<object>} items
 */
export function dedupBriefingItems(items) {
  const keyToIndex = new Map();
  const result = [];

  for (const item of items) {
    const keys = buildDedupKeys(item);
    if (!keys.length) {
      result.push({ ...item });
      continue;
    }

    let matchIdx = null;
    for (const k of keys) {
      if (keyToIndex.has(k)) {
        matchIdx = keyToIndex.get(k);
        break;
      }
    }

    if (matchIdx == null) {
      const entry = {
        ...item,
        dedupSources: item.sourceLabel ? [item.sourceLabel] : [],
      };
      const idx = result.length;
      result.push(entry);
      for (const k of keys) keyToIndex.set(k, idx);
      continue;
    }

    const prev = result[matchIdx];
    const sources = new Set([...(prev.dedupSources || []), prev.sourceLabel, item.sourceLabel].filter(Boolean));
    if ((item.importance || 0) > (prev.importance || 0)) {
      result[matchIdx] = {
        ...item,
        dedupSources: [...sources],
        dedupMerged: true,
      };
    } else {
      result[matchIdx] = {
        ...prev,
        dedupSources: [...sources],
        dedupMerged: true,
      };
    }
    for (const k of keys) keyToIndex.set(k, matchIdx);
  }

  return result;
}
