/**
 * V10 — Browser URL/page sensitivity guard (login, payment, purchase hard-stop).
 */

const SENSITIVE_URL_PATTERNS = [
  /\/login\b/i,
  /\/sign[-_]?in\b/i,
  /\/auth\b/i,
  /\/checkout\b/i,
  /\/payment\b/i,
  /\/pay\b/i,
  /\/wallet\b/i,
  /\/bank\b/i,
  /\/2fa\b/i,
  /\/otp\b/i,
  /\/purchase\b/i,
  /\/order\/confirm/i,
  /sepet/i,
  /odeme/i,
  /ödeme/i,
  /satin[-_]?al/i,
  /satın[-_]?al/i,
];

const BLOCKED_URL_SCHEMES = ["file:", "javascript:", "data:"];

const SENSITIVE_PAGE_PATTERNS = [
  /\bpassword\b/i,
  /\bcredit\s*card\b/i,
  /\bcheckout\b/i,
  /\bpayment\b/i,
  /\bsepete\s+ekle\b/i,
  /\bsatın\s+al\b/i,
  /\bplace\s+order\b/i,
  /\bcomplete\s+purchase\b/i,
];

/**
 * @param {string} url
 */
export function classifyBrowserUrl(url) {
  if (!url || typeof url !== "string") {
    return { classification: "blocked", reason: "URL required" };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { classification: "blocked", reason: "Invalid URL" };
  }

  if (BLOCKED_URL_SCHEMES.some((s) => parsed.protocol === s)) {
    return { classification: "blocked", reason: `Scheme ${parsed.protocol} not allowed` };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { classification: "blocked", reason: "Only http(s) URLs allowed" };
  }

  const haystack = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
  if (SENSITIVE_URL_PATTERNS.some((re) => re.test(haystack))) {
    return {
      classification: "sensitive",
      reason: "URL appears to be login, payment, or checkout",
      url: parsed.href,
    };
  }

  return { classification: "normal", url: parsed.href };
}

/**
 * @param {{ title?: string, html?: string, url?: string }} page
 */
export function classifyBrowserPage(page = {}) {
  const haystack = `${page.title || ""} ${page.url || ""} ${(page.html || "").slice(0, 8000)}`;
  const reasons = [];

  for (const re of SENSITIVE_PAGE_PATTERNS) {
    if (re.test(haystack)) reasons.push(`page:${re.source}`);
  }

  const urlClass = page.url ? classifyBrowserUrl(page.url) : { classification: "normal" };
  if (urlClass.classification === "sensitive") {
    reasons.push("url:sensitive");
  }

  return {
    sensitive: reasons.length > 0 || urlClass.classification === "sensitive",
    reasons,
    urlClassification: urlClass.classification,
  };
}

/**
 * @param {{ action: string, url?: string, title?: string, html?: string }} ctx
 */
export function assertBrowserActionAllowed(ctx = {}) {
  const { action, url, title, html } = ctx;
  const isWriteAction = ["click", "type"].includes(action);

  if (url) {
    const urlClass = classifyBrowserUrl(url);
    if (urlClass.classification === "blocked") {
      return {
        ok: false,
        error: { code: "url_blocked", message: urlClass.reason || "URL blocked" },
      };
    }
    if (isWriteAction && urlClass.classification === "sensitive") {
      return {
        ok: false,
        error: {
          code: "browser_sensitive_hard_stop",
          message: "Browser click/type blocked on login/payment/checkout URLs",
          reasons: [urlClass.reason],
        },
      };
    }
  }

  const pageClass = classifyBrowserPage({ title, html, url });
  if (isWriteAction && pageClass.sensitive) {
    return {
      ok: false,
      error: {
        code: "browser_sensitive_hard_stop",
        message: "Browser click/type blocked on sensitive page content",
        reasons: pageClass.reasons,
      },
    };
  }

  return {
    ok: true,
    data: {
      requireApproval: pageClass.sensitive || pageClass.urlClassification === "sensitive",
      classification: pageClass.sensitive ? "sensitive" : "normal",
      reasons: pageClass.reasons,
    },
  };
}
