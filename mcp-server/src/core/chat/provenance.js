/**
 * V8 Faz A — prompt pattern provenance metadata.
 */

/** @typedef {"low" | "medium" | "high"} ProvenanceRisk */

/**
 * @typedef {Object} PromptProvenance
 * @property {string} sourceProvider
 * @property {string} [sourceFile]
 * @property {string} derivedAt — ISO date
 * @property {string} [reviewer]
 * @property {ProvenanceRisk} risk
 * @property {string} [notes]
 */

const RISKS = new Set(["low", "medium", "high"]);

/**
 * @param {unknown} value
 * @returns {value is PromptProvenance}
 */
export function isValidProvenance(value) {
  if (!value || typeof value !== "object") return false;
  const p = /** @type {PromptProvenance} */ (value);
  return (
    typeof p.sourceProvider === "string" &&
    p.sourceProvider.trim().length > 0 &&
    typeof p.derivedAt === "string" &&
    RISKS.has(p.risk)
  );
}

/**
 * @param {PromptProvenance} provenance
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function validateProvenance(provenance) {
  const errors = [];
  if (!isValidProvenance(provenance)) {
    return { ok: false, errors: ["provenance must include sourceProvider, derivedAt, risk"] };
  }
  if (provenance.risk === "high") {
    errors.push("high-risk patterns must be disabled until human review");
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
