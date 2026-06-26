/**
 * Auto memory write policy — gate brain_remember calls.
 */

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|secret|token|password|passwd|credential)\b/i,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bBearer\s+[a-zA-Z0-9._-]+/i,
];

const SENSITIVE_PATTERNS = [
  /\b(?:tc\s*kimlik|ssn|credit\s*card|kart\s*no|iban)\b/i,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
];

const FINANCIAL_PATTERNS = [
  /\b(?:tl|usd|eur|₺|\$)\s*[\d.,]+/i,
  /[\d.,]+\s*(?:tl|usd|eur)\b/i,
  /\b(?:bütçe|budget|fatura|invoice|maaş|salary|ödeme|payment)\b/i,
];

const PERSON_NAME_PATTERN = /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+\b/;

const EPHEMERAL_PATTERNS = [
  /\b(?:şu\s+an|right\s+now|bugün\s+sadece|just\s+this\s+once)\b/i,
  /\b(?:geçici\s+hata|temporary\s+error|timeout)\b/i,
];

const REMEMBER_WORTHY = [
  /\b(?:tercih|prefer|always|asla|never|karar|decided|hatırla|remember)\b/i,
  /\b(?:workflow|mimari|architecture|stack|proje\s+notu)\b/i,
];

/**
 * @param {string} content
 * @param {{ explicitSave?: boolean; source?: string }} [opts]
 */
export function evaluateMemoryWrite(content, opts = {}) {
  const text = typeof content === "string" ? content.trim() : "";
  const explicitSave = opts.explicitSave === true;

  if (!text) {
    return {
      shouldRemember: false,
      sensitiveRisk: false,
      reason: "empty_content",
      type: null,
      scope: null,
      confidence: 0,
    };
  }

  if (SECRET_PATTERNS.some((p) => p.test(text))) {
    return {
      shouldRemember: false,
      sensitiveRisk: true,
      reason: "contains_secret_or_credential",
      type: null,
      scope: null,
      confidence: 0,
    };
  }

  if (SENSITIVE_PATTERNS.some((p) => p.test(text))) {
    return {
      shouldRemember: false,
      sensitiveRisk: true,
      reason: "contains_sensitive_pii",
      type: null,
      scope: null,
      confidence: 0,
      requiresApproval: true,
    };
  }

  if (
    FINANCIAL_PATTERNS.some((p) => p.test(text)) &&
    PERSON_NAME_PATTERN.test(text)
  ) {
    return {
      shouldRemember: true,
      sensitiveRisk: true,
      reason: "financial_with_personal_name",
      type: null,
      scope: null,
      confidence: 0.6,
      requiresApproval: true,
    };
  }

  if (!explicitSave && EPHEMERAL_PATTERNS.some((p) => p.test(text))) {
    return {
      shouldRemember: false,
      sensitiveRisk: false,
      reason: "ephemeral_one_off",
      type: null,
      scope: null,
      confidence: 0.3,
    };
  }

  if (opts.source === "agent" || opts.source === "system") {
    return {
      shouldRemember: true,
      sensitiveRisk: false,
      reason: "agent_initiated",
      type: null,
      scope: null,
      confidence: 0.85,
      requiresApproval: false,
    };
  }

  const worthy =
    explicitSave ||
    REMEMBER_WORTHY.some((p) => p.test(text)) ||
    text.length > 40;

  return {
    shouldRemember: worthy,
    sensitiveRisk: false,
    reason: explicitSave ? "explicit_save" : worthy ? "durable_information" : "trivial_request",
    type: null,
    scope: null,
    confidence: explicitSave ? 0.95 : worthy ? 0.7 : 0.4,
    requiresApproval: false,
  };
}
