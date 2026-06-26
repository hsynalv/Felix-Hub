/**
 * Block http_request to vendor APIs when dedicated hub tools exist.
 * Prevents the model from inventing REST paths (e.g. Tavily /v1/convert).
 */

import { listTools } from "../tool-registry.js";

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   hostSuffixes?: string[];
 *   pathPatterns?: RegExp[];
 *   toolPrefixes: string[];
 *   exampleTools: string[];
 *   note?: string;
 * }} VendorRouteRule
 */

/** @type {VendorRouteRule[]} */
export const VENDOR_ROUTE_RULES = [
  {
    id: "tavily",
    label: "Tavily",
    hostSuffixes: ["tavily.com"],
    toolPrefixes: ["tavily__", "tavily_"],
    exampleTools: ["tavily__tavily_search", "tavily__tavily_extract"],
    note: "No public REST convert/currency API — use Tavily MCP search with a natural-language query.",
  },
  {
    id: "github",
    label: "GitHub",
    hostSuffixes: ["api.github.com", "github.com"],
    pathPatterns: [/^\/repos\//, /^\/user/, /^\/orgs\//, /^\/search\//],
    toolPrefixes: ["github_"],
    exampleTools: ["github_list_repos", "github_get_file", "github_pr_list"],
  },
  {
    id: "notion",
    label: "Notion",
    hostSuffixes: ["api.notion.com"],
    toolPrefixes: ["notion_"],
    exampleTools: ["notion_search", "notion_create_page", "notion_update_page"],
  },
  {
    id: "slack",
    label: "Slack",
    hostSuffixes: ["slack.com", "hooks.slack.com"],
    pathPatterns: [/^\/api\//],
    toolPrefixes: ["slack_"],
    exampleTools: ["slack_post_message"],
  },
  {
    id: "n8n",
    label: "n8n",
    pathPatterns: [/\/api\/v1\/(workflows|executions|credentials|tags)/i],
    toolPrefixes: ["n8n_"],
    exampleTools: ["n8n_list_workflows", "n8n_execute_workflow"],
  },
  {
    id: "openai",
    label: "OpenAI",
    hostSuffixes: ["api.openai.com"],
    toolPrefixes: ["llm_", "openai_"],
    exampleTools: ["llm_chat", "llm_route"],
    note: "Use llm-router tools instead of raw OpenAI REST.",
  },
  {
    id: "figma",
    label: "Figma",
    hostSuffixes: ["api.figma.com"],
    toolPrefixes: ["figma__", "figma_"],
    exampleTools: ["figma__get_file", "figma__get_design_context"],
  },
];

/** Paths commonly hallucinated by LLMs — block on any host when dedicated tools exist nearby */
const HALLUCINATED_PATH_SEGMENTS = [
  /\/v\d+\/convert\b/i,
  /\/convert\b/i,
  /\/currency\b/i,
  /\/exchange[-_]?rate/i,
  /\/translate\b/i,
  /\/magic\b/i,
];

function hostMatches(hostname, suffixes = []) {
  const host = (hostname || "").toLowerCase();
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`) || host.endsWith(s));
}

function pathMatches(pathname, patterns = []) {
  if (!patterns.length) return true;
  const path = pathname || "/";
  return patterns.some((p) => p.test(path));
}

function toolNameMatchesPrefixes(name, prefixes) {
  return prefixes.some((p) => name.startsWith(p));
}

function getRegisteredToolNames() {
  try {
    return listTools().map((t) => t.name);
  } catch {
    return [];
  }
}

function findAvailableExamples(rule, registered) {
  const fromRegistry = registered.filter((n) => toolNameMatchesPrefixes(n, rule.toolPrefixes));
  const examples = [...new Set([...fromRegistry.slice(0, 4), ...rule.exampleTools])].slice(0, 4);
  return examples;
}

function hasDedicatedTools(rule, registered) {
  return registered.some((n) => toolNameMatchesPrefixes(n, rule.toolPrefixes));
}

/**
 * @param {string} url
 * @param {string[]} [registeredToolNames]
 * @returns {{ blocked: boolean; reason?: string; ruleId?: string }}
 */
export function checkHttpRequestDedicatedRouting(url, registeredToolNames) {
  if (!url || typeof url !== "string") return { blocked: false };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { blocked: false };
  }

  const registered = registeredToolNames ?? getRegisteredToolNames();
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname || "/";

  for (const rule of VENDOR_ROUTE_RULES) {
    const hostOk = rule.hostSuffixes?.length
      ? hostMatches(hostname, rule.hostSuffixes)
      : false;
    const pathOk = rule.pathPatterns?.length ? pathMatches(pathname, rule.pathPatterns) : false;

    if (!hostOk && !pathOk) continue;
    if (!hasDedicatedTools(rule, registered)) continue;

    const examples = findAvailableExamples(rule, registered).map((n) => `\`${n}\``).join(", ");
    const note = rule.note ? ` ${rule.note}` : "";
    return {
      blocked: true,
      ruleId: rule.id,
      reason:
        `${rule.label} has dedicated hub tools — do not use http_request to ${parsed.origin}${pathname}. ` +
        `Use: ${examples}.${note}`,
    };
  }

  if (HALLUCINATED_PATH_SEGMENTS.some((p) => p.test(pathname))) {
    return {
      blocked: true,
      ruleId: "hallucinated_path",
      reason:
        `URL path "${pathname}" looks like an invented REST endpoint (convert/currency/translate). ` +
        "Use a dedicated search/API tool (e.g. tavily__tavily_search) or a documented allowlisted API — do not guess paths.",
    };
  }

  return { blocked: false };
}
