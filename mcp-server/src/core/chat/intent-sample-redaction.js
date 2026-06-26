/**
 * Redact PII/secrets from text before intent training sample storage.
 */

const PATTERNS = [
  { name: "api_key", re: /\b(?:sk|pk|rk|api)[-_][a-zA-Z0-9]{16,}\b/gi, mask: "[REDACTED_API_KEY]" },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{20,}\b/gi, mask: "[REDACTED_TOKEN]" },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, mask: "[REDACTED_JWT]" },
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, mask: "[REDACTED_EMAIL]" },
  { name: "phone", re: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{2,4}\b/g, mask: "[REDACTED_PHONE]" },
  {
    name: "card",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    mask: "[REDACTED_CARD]",
  },
  {
    name: "iban",
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
    mask: "[REDACTED_IBAN]",
  },
  {
    name: "amount",
    re: /\b(?:₺|\$|€|£)\s?[\d.,]+(?:\s?(?:tl|try|usd|eur|gbp))?\b/gi,
    mask: "[REDACTED_AMOUNT]",
  },
  {
    name: "amount_tr",
    re: /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s?(?:tl|try|usd|eur|gbp|dolar|euro)\b/gi,
    mask: "[REDACTED_AMOUNT]",
  },
];

/**
 * @param {string} text
 * @returns {{ text: string; redactions: string[] }}
 */
export function redactIntentSampleText(text) {
  if (!text || typeof text !== "string") return { text: "", redactions: [] };
  let out = text;
  const redactions = [];
  for (const { name, re, mask } of PATTERNS) {
    if (re.test(out)) {
      redactions.push(name);
      out = out.replace(re, mask);
    }
    re.lastIndex = 0;
  }
  return { text: out.slice(0, 2000), redactions };
}
