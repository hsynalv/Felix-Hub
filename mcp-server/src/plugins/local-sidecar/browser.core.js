/**
 * V10 Faz D — Browser runtime MVP (fetch + optional Playwright).
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { assertBrowserActionAllowed, classifyBrowserPage } from "./browser-guard.js";
import {
  buildPageSnapshot,
  extractLinksFromHtml,
  extractTablesFromHtml,
  findTextInHtml,
} from "./browser-html.js";
import {
  isPlaywrightAvailable,
  playwrightGoto,
  playwrightScreenshot,
  playwrightClick,
  playwrightType,
} from "./browser-playwright.js";
import { captureWindowScreenshot } from "./desktop.core.js";

const execFileAsync = promisify(execFile);
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** @type {{ url: string | null, title: string, html: string, engine: string, fetchedAt: string | null }} */
let session = {
  url: null,
  title: "",
  html: "",
  engine: "none",
  fetchedAt: null,
};

export function getBrowserSession() {
  return { ...session };
}

/** @internal */
export function resetBrowserSessionForTests() {
  session = { url: null, title: "", html: "", engine: "none", fetchedAt: null };
}

function updateSession({ url, title, html, engine }) {
  session = {
    url,
    title: title || "",
    html: html || "",
    engine,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPageHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Felix-Desktop-Sidecar/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    return {
      ok: false,
      error: { code: "fetch_failed", message: `HTTP ${res.status} for ${url}` },
    };
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HTML_BYTES) {
    return {
      ok: false,
      error: { code: "page_too_large", message: `Page exceeds ${MAX_HTML_BYTES} bytes` },
    };
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

  return {
    ok: true,
    data: { url: res.url || url, title, html, engine: "fetch" },
  };
}

async function openInSystemBrowser(url, browser = "Google Chrome") {
  if (process.platform !== "darwin") return;
  const app = browser || "Google Chrome";
  await execFileAsync("open", ["-a", app, url], { timeout: 10_000 });
}

/**
 * @param {{ url: string, browser?: string, usePlaywright?: boolean }} params
 */
export async function browserOpenUrl({ url, browser, usePlaywright } = {}) {
  if (!url) {
    return { ok: false, error: { code: "missing_url", message: "url required" } };
  }

  const guard = assertBrowserActionAllowed({ action: "open", url });
  if (!guard.ok) return guard;

  const preferPw = usePlaywright !== false && (await isPlaywrightAvailable());

  if (preferPw) {
    const pw = await playwrightGoto(url);
    if (pw.ok) {
      updateSession(pw.data);
      const pageClass = classifyBrowserPage(session);
      return {
        ok: true,
        data: {
          url: session.url,
          title: session.title,
          engine: session.engine,
          sensitive: pageClass.sensitive,
          sensitiveReasons: pageClass.reasons,
          requireApproval: guard.data?.requireApproval,
        },
      };
    }
    if (pw.error?.code !== "playwright_not_installed") return pw;
  }

  const fetched = await fetchPageHtml(url);
  if (!fetched.ok) return fetched;

  updateSession(fetched.data);

  try {
    await openInSystemBrowser(url, browser);
  } catch {
    /* visual open optional */
  }

  const pageClass = classifyBrowserPage(session);
  return {
    ok: true,
    data: {
      url: session.url,
      title: session.title,
      engine: session.engine,
      sensitive: pageClass.sensitive,
      sensitiveReasons: pageClass.reasons,
      requireApproval: guard.data?.requireApproval,
    },
  };
}

export async function browserSnapshot() {
  if (!session.url || !session.html) {
    return { ok: false, error: { code: "no_session", message: "Call browser_open_url first" } };
  }

  const guard = assertBrowserActionAllowed({
    action: "snapshot",
    url: session.url,
    title: session.title,
    html: session.html,
  });
  if (!guard.ok) return guard;

  const snapshot = buildPageSnapshot(session.html, { url: session.url, title: session.title });
  const pageClass = classifyBrowserPage(session);

  return {
    ok: true,
    data: {
      ...snapshot,
      engine: session.engine,
      fetchedAt: session.fetchedAt,
      sensitive: pageClass.sensitive,
      sensitiveReasons: pageClass.reasons,
    },
  };
}

export async function browserScreenshot() {
  if (!session.url) {
    return { ok: false, error: { code: "no_session", message: "Call browser_open_url first" } };
  }

  const guard = assertBrowserActionAllowed({
    action: "screenshot",
    url: session.url,
    title: session.title,
    html: session.html,
  });
  if (!guard.ok) return guard;

  if (session.engine === "playwright" && (await isPlaywrightAvailable())) {
    const shot = await playwrightScreenshot();
    if (shot.ok) {
      const pageClass = classifyBrowserPage(session);
      if (pageClass.sensitive) {
        shot.data.sensitiveContext = true;
        shot.data.sensitiveReasons = pageClass.reasons;
        shot.data.deliveryBlocked = true;
      }
      return shot;
    }
  }

  if (process.platform === "darwin") {
    try {
      await openInSystemBrowser(session.url);
      await new Promise((r) => setTimeout(r, 1500));
      const shot = await captureWindowScreenshot({ format: "png" });
      if (shot.ok) {
        shot.data.url = session.url;
        shot.data.engine = "window_capture";
      }
      return shot;
    } catch (err) {
      return { ok: false, error: { code: "screenshot_failed", message: err.message } };
    }
  }

  return {
    ok: false,
    error: {
      code: "screenshot_unavailable",
      message: "Install playwright on sidecar or use macOS window capture",
    },
  };
}

export async function browserExtractLinks({ maxLinks = 50 } = {}) {
  if (!session.html) {
    return { ok: false, error: { code: "no_session", message: "Call browser_open_url first" } };
  }

  const links = extractLinksFromHtml(session.html, session.url || "", maxLinks);
  return {
    ok: true,
    data: { url: session.url, count: links.length, links },
  };
}

export async function browserExtractTable({ maxTables = 3 } = {}) {
  if (!session.html) {
    return { ok: false, error: { code: "no_session", message: "Call browser_open_url first" } };
  }

  const tables = extractTablesFromHtml(session.html, maxTables);
  return {
    ok: true,
    data: { url: session.url, count: tables.length, tables },
  };
}

export async function browserFindText({ query, maxMatches = 10 } = {}) {
  if (!session.html) {
    return { ok: false, error: { code: "no_session", message: "Call browser_open_url first" } };
  }
  if (!query) {
    return { ok: false, error: { code: "missing_query", message: "query required" } };
  }

  const matches = findTextInHtml(session.html, query, maxMatches);
  return {
    ok: true,
    data: { url: session.url, query, count: matches.length, matches },
  };
}

export async function browserClick({ selector } = {}) {
  if (!selector) {
    return { ok: false, error: { code: "missing_selector", message: "selector required" } };
  }

  const guard = assertBrowserActionAllowed({
    action: "click",
    url: session.url,
    title: session.title,
    html: session.html,
  });
  if (!guard.ok) return guard;

  if (!(await isPlaywrightAvailable()) || session.engine !== "playwright") {
    return {
      ok: false,
      error: {
        code: "playwright_required",
        message:
          "browser_click requires Playwright. On sidecar Mac: npm install playwright && npx playwright install chromium, then browser_open_url with JS pages.",
      },
    };
  }

  const result = await playwrightClick(selector);
  if (result.ok) {
    updateSession({
      url: result.data.url,
      title: result.data.title,
      html: result.data.html,
      engine: "playwright",
    });
  }
  return result;
}

export async function browserType({ selector, text } = {}) {
  if (!selector || text == null) {
    return { ok: false, error: { code: "invalid_args", message: "selector and text required" } };
  }

  const guard = assertBrowserActionAllowed({
    action: "type",
    url: session.url,
    title: session.title,
    html: session.html,
  });
  if (!guard.ok) return guard;

  if (!(await isPlaywrightAvailable()) || session.engine !== "playwright") {
    return {
      ok: false,
      error: {
        code: "playwright_required",
        message: "browser_type requires Playwright on the sidecar",
      },
    };
  }

  return playwrightType(selector, text);
}
