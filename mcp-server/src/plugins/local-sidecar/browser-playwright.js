/**
 * Optional Playwright engine for full browser automation on sidecar.
 */

let playwrightModule = null;
let playwrightChecked = false;

/** @type {{ browser: import('playwright').Browser | null, context: import('playwright').BrowserContext | null, page: import('playwright').Page | null }} */
const pwSession = { browser: null, context: null, page: null };

export async function isPlaywrightAvailable() {
  if (playwrightChecked) return Boolean(playwrightModule);
  playwrightChecked = true;
  try {
    playwrightModule = await import("playwright");
    return true;
  } catch {
    playwrightModule = null;
    return false;
  }
}

export async function ensurePlaywrightPage() {
  if (!(await isPlaywrightAvailable())) {
    return {
      ok: false,
      error: {
        code: "playwright_not_installed",
        message: "Install playwright on sidecar: npm install playwright && npx playwright install chromium",
      },
    };
  }

  if (!pwSession.browser) {
    const browser = await playwrightModule.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Felix-Desktop-Sidecar/1.0",
    });
    const page = await context.newPage();
    pwSession.browser = browser;
    pwSession.context = context;
    pwSession.page = page;
  }

  return { ok: true, page: pwSession.page };
}

export async function playwrightGoto(url) {
  const ready = await ensurePlaywrightPage();
  if (!ready.ok) return ready;

  await ready.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  return {
    ok: true,
    data: {
      url: ready.page.url(),
      title: await ready.page.title(),
      html: await ready.page.content(),
      engine: "playwright",
    },
  };
}

export async function playwrightScreenshot() {
  const ready = await ensurePlaywrightPage();
  if (!ready.ok) return ready;
  if (!ready.page.url() || ready.page.url() === "about:blank") {
    return { ok: false, error: { code: "no_page", message: "Open a URL first with browser_open_url" } };
  }

  const buf = await ready.page.screenshot({ type: "png" });
  return {
    ok: true,
    data: {
      format: "png",
      imageBase64: buf.toString("base64"),
      byteLength: buf.length,
      url: ready.page.url(),
      title: await ready.page.title(),
      engine: "playwright",
    },
  };
}

export async function playwrightClick(selector) {
  const ready = await ensurePlaywrightPage();
  if (!ready.ok) return ready;
  await ready.page.click(selector, { timeout: 10_000 });
  return {
    ok: true,
    data: {
      selector,
      url: ready.page.url(),
      title: await ready.page.title(),
      html: await ready.page.content(),
    },
  };
}

export async function playwrightType(selector, text) {
  const ready = await ensurePlaywrightPage();
  if (!ready.ok) return ready;
  await ready.page.fill(selector, text, { timeout: 10_000 });
  return {
    ok: true,
    data: {
      selector,
      length: String(text).length,
      url: ready.page.url(),
      title: await ready.page.title(),
    },
  };
}

export function getPlaywrightPageMeta() {
  if (!pwSession.page) return null;
  return { page: pwSession.page };
}

/** @internal */
export async function closePlaywrightForTests() {
  if (pwSession.browser) await pwSession.browser.close().catch(() => {});
  pwSession.browser = null;
  pwSession.context = null;
  pwSession.page = null;
  playwrightModule = null;
  playwrightChecked = false;
}
