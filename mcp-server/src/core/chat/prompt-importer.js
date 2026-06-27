/**
 * V8 Faz C — scan external prompt archive → derived draft patterns.
 */

import { readFile, readdir, mkdir, writeFile, access } from "fs/promises";
import { join, relative, basename } from "path";
import { STANDARD_SECTION_KEYS } from "../chat/prompt-constants.js";
import { validateProvenance } from "../chat/provenance.js";

const BANNED_PHRASES = [
  /ignore\s+(all\s+)?policy/i,
  /bypass\s+approval/i,
  /pretend\s+you\s+are/i,
  /you\s+are\s+chatgpt/i,
  /you\s+are\s+cursor/i,
  /you\s+are\s+claude/i,
];

const HEADER_TO_SECTION = [
  { pattern: /^#+\s*identity/i, key: "identity" },
  { pattern: /^#+\s*capabilities/i, key: "capabilities" },
  { pattern: /^#+\s*rules?/i, key: "non_compliance" },
  { pattern: /^#+\s*response/i, key: "response_style" },
  { pattern: /^#+\s*tool/i, key: "tool_calling" },
  { pattern: /^<tool_calling>/i, key: "tool_calling" },
  { pattern: /^#+\s*spec/i, key: "completion_spec" },
  { pattern: /^#+\s*memory/i, key: "memory_injection" },
  { pattern: /^#+\s*flow/i, key: "flow" },
  { pattern: /^#+\s*code/i, key: "code_style" },
];

const XML_TAG_SECTION = [
  { tag: "tool_calling", key: "tool_calling" },
  { tag: "communication", key: "response_style" },
  { tag: "search_and_reading", key: "context_understanding" },
  { tag: "making_code_changes", key: "code_style" },
];

/**
 * @param {string} header
 */
function mapHeaderToSection(header) {
  for (const { pattern, key } of HEADER_TO_SECTION) {
    if (pattern.test(header.trim())) return key;
  }
  return "context_understanding";
}

/**
 * @param {string} text
 */
export function segmentPromptText(text) {
  const segments = [];
  const lines = text.split("\n");
  let currentKey = "identity";
  let currentTitle = "Preamble";
  let buf = [];

  const flush = () => {
    if (buf.length) {
      segments.push({ sectionKey: currentKey, title: currentTitle, body: buf.join("\n").trim() });
      buf = [];
    }
  };

  for (const line of lines) {
    if (/^#+\s+/.test(line) || /^<[a-z_]+>/i.test(line)) {
      flush();
      currentTitle = line.trim();
      currentKey = mapHeaderToSection(line);
      const xml = line.match(/^<([a-z_]+)>/i);
      if (xml) {
        const mapped = XML_TAG_SECTION.find((x) => x.tag === xml[1].toLowerCase());
        if (mapped) currentKey = mapped.key;
      }
      continue;
    }
    buf.push(line);
  }
  flush();
  return segments;
}

/**
 * Derive bullet spec from body — no verbatim long paste.
 * @param {string} body
 */
export function deriveBehaviorBullets(body) {
  const bullets = [];
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^[-*•]\s+/.test(t) || /^\d+\.\s+/.test(t)) {
      const cleaned = t.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").slice(0, 160);
      if (cleaned.length > 12) bullets.push(cleaned);
    }
  }
  if (!bullets.length) {
    const words = body.split(/\s+/).filter(Boolean).slice(0, 40).join(" ");
    return [`Review derived summary: ${words}…`];
  }
  return bullets.slice(0, 6).map((b) => `Derived behavior: ${b}`);
}

/**
 * @param {string} body
 */
export function detectRisk(body) {
  for (const re of BANNED_PHRASES) {
    if (re.test(body)) return "high";
  }
  if (/shell|bypass|ignore policy|do not ask/i.test(body)) return "medium";
  return "low";
}

/**
 * @param {string} filePath
 * @param {string} content
 * @param {string} provider
 */
export function buildDraftFromFile(filePath, content, provider) {
  const segments = segmentPromptText(content);
  const sections = {};
  for (const seg of segments) {
    const key = STANDARD_SECTION_KEYS.includes(seg.sectionKey) ? seg.sectionKey : "context_understanding";
    const derived = deriveBehaviorBullets(seg.body).join("\n");
    sections[key] = sections[key] ? `${sections[key]}\n${derived}` : derived;
  }

  const risk = segments.some((s) => detectRisk(s.body) === "high")
    ? "high"
    : segments.some((s) => detectRisk(s.body) === "medium")
      ? "medium"
      : "low";

  const provenance = {
    sourceProvider: provider,
    sourceFile: filePath,
    derivedAt: new Date().toISOString().slice(0, 10),
    reviewer: "prompt-importer",
    risk,
    notes: "Auto-derived draft — human review required before enable.",
  };

  return {
    id: `draft-${provider.toLowerCase()}-${basename(filePath).replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`,
    name: `${provider} draft — ${basename(filePath)}`,
    description: `Imported draft from ${provider} (derived patterns only)`,
    mode: provider.toLowerCase() === "kiro" ? "spec" : "agent",
    tags: ["imported", "draft", provider.toLowerCase()],
    disabled: risk === "high",
    provenance,
    sections,
    segmentCount: segments.length,
  };
}

/**
 * @param {string} dir
 * @param {{ providerFilter?: string; maxFiles?: number }} opts
 */
export async function scanPromptArchive(dir, opts = {}) {
  const maxFiles = opts.maxFiles ?? 200;
  const results = [];

  async function walk(current, providerHint = "") {
    if (results.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (results.length >= maxFiles) break;
      const full = join(current, ent.name);
      if (ent.isDirectory()) {
        const hint = ent.name;
        await walk(full, hint);
        continue;
      }
      if (!/\.(txt|md|yaml|yml|json)$/i.test(ent.name)) continue;
      const provider = providerHint || basename(current);
      if (opts.providerFilter && !provider.toLowerCase().includes(opts.providerFilter.toLowerCase())) {
        continue;
      }
      const content = await readFile(full, "utf8");
      const draft = buildDraftFromFile(relative(dir, full), content, provider);
      if (validateProvenance(draft.provenance).ok) {
        results.push(draft);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * @param {string} outDir
 * @param {object[]} drafts
 */
export async function writeDraftReport(outDir, drafts) {
  try {
    await access(outDir);
  } catch {
    await mkdir(outDir, { recursive: true });
  }
  const reportPath = join(outDir, "import-report.json");
  await writeFile(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: drafts.length, drafts }, null, 2),
    "utf8"
  );
  for (const d of drafts) {
    await writeFile(join(outDir, `${d.id}.json`), JSON.stringify(d, null, 2), "utf8");
  }
  return reportPath;
}
