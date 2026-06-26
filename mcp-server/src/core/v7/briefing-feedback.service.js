/**
 * V7 — Briefing feedback loop (ranking + hide).
 */

import {
  addBriefingFeedback,
  listBriefingFeedback,
  getFeedbackSummaryByItem,
  BRIEFING_FEEDBACK_TYPES,
} from "./briefing-feedback-store.js";

export { BRIEFING_FEEDBACK_TYPES };

export function submitBriefingFeedback(input) {
  return addBriefingFeedback(input);
}

export function getBriefingFeedbackHistory(opts) {
  return listBriefingFeedback(opts);
}

/**
 * Apply user feedback to briefing items before display.
 * @param {Array<{ id: string, importance: number, source?: string }>} items
 */
export function applyBriefingFeedbackToItems(items) {
  const summary = getFeedbackSummaryByItem();
  const adjusted = [];

  for (const item of items) {
    const fb = summary.get(item.id);
    if (!fb) {
      adjusted.push(item);
      continue;
    }
    if (fb.notRelevant >= 2) continue;

    let importance = item.importance ?? 0;
    importance -= fb.showLess * 12;
    importance += fb.showMore * 8;
    importance += fb.relevant * 4;
    adjusted.push({ ...item, importance: Math.max(0, Math.min(100, importance)) });
  }

  return adjusted.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
}
