/** Normalize MSSQL/API GUID strings for stable comparisons. */
export function normalizeConversationId(id?: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim().replace(/^\{|\}$/g, "");
  return trimmed ? trimmed.toLowerCase() : null;
}

export function conversationIdsMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeConversationId(a);
  const right = normalizeConversationId(b);
  return !!left && !!right && left === right;
}
