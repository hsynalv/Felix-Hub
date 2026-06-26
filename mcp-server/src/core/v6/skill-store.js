/**
 * Agent skill manifest persistence (V6.2).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH =
  process.env.SKILL_STORE || join(config.catalog?.cacheDir || "./cache", "agent-skills.json");

const BUILTIN_SKILLS = [
  {
    id: "skill-ci-heal",
    name: "CI Failure Repair",
    description: "Diagnose and propose fixes for failing CI pipelines.",
    version: 1,
    builtin: true,
    templateId: "ci-failure-heal",
    tags: ["ci", "devops"],
    parameters: [{ name: "repoUrl", type: "string", required: false }],
    phases: [{ type: "template", templateId: "ci-failure-heal" }],
  },
  {
    id: "skill-incident-triage",
    name: "Incident Triage",
    description: "Gather signals and produce an incident triage brief.",
    version: 1,
    builtin: true,
    templateId: "incident-triage",
    tags: ["ops", "incident"],
    parameters: [{ name: "severity", type: "string", required: false }],
    phases: [{ type: "template", templateId: "incident-triage" }],
  },
  {
    id: "skill-research-brief",
    name: "Research Brief",
    description: "Multi-step research with planner and executor roles.",
    version: 1,
    builtin: true,
    tags: ["research"],
    parameters: [{ name: "topic", type: "string", required: true }],
    phases: [
      { type: "agent", role: "researcher", goal: "Gather context on {{topic}}" },
      { type: "agent", role: "planner", goal: "Plan deliverables for {{topic}}" },
      { type: "agent", role: "reviewer", goal: "Review research brief for {{topic}}" },
    ],
  },
];

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ skills: BUILTIN_SKILLS }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    const skills = Array.isArray(raw.skills) ? raw.skills : [];
    if (!skills.length) {
      writeStore({ skills: BUILTIN_SKILLS });
      return { skills: BUILTIN_SKILLS };
    }
    return { skills };
  } catch {
    return { skills: BUILTIN_SKILLS };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function normalizeSkill(s) {
  return {
    id: s.id,
    name: s.name,
    description: s.description || "",
    version: s.version || 1,
    builtin: !!s.builtin,
    templateId: s.templateId || null,
    tags: Array.isArray(s.tags) ? s.tags : [],
    parameters: Array.isArray(s.parameters) ? s.parameters : [],
    phases: Array.isArray(s.phases) ? s.phases : [],
    projectId: s.projectId || null,
    createdAt: s.createdAt || new Date().toISOString(),
    updatedAt: s.updatedAt || new Date().toISOString(),
  };
}

export function listSkills({ projectId = null, tag = null } = {}) {
  let items = readStore().skills.map(normalizeSkill);
  if (projectId) items = items.filter((s) => !s.projectId || s.projectId === projectId);
  if (tag) items = items.filter((s) => s.tags.includes(tag));
  return items;
}

export function getSkillById(id) {
  const s = readStore().skills.find((x) => x.id === id);
  return s ? normalizeSkill(s) : null;
}

export function createSkill(input) {
  if (!input.name) {
    throw Object.assign(new Error("name required"), { code: "invalid" });
  }
  const now = new Date().toISOString();
  const skill = normalizeSkill({
    ...input,
    id: input.id || `skill-${randomUUID().slice(0, 8)}`,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  });
  const store = readStore();
  if (store.skills.some((s) => s.id === skill.id)) {
    throw Object.assign(new Error(`Skill already exists: ${skill.id}`), { code: "conflict" });
  }
  store.skills.push(skill);
  writeStore(store);
  return skill;
}

export function updateSkill(id, patch) {
  const store = readStore();
  const idx = store.skills.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  if (store.skills[idx].builtin && patch.builtin === false) {
    throw Object.assign(new Error("Cannot demote builtin skill"), { code: "forbidden" });
  }
  const updated = normalizeSkill({
    ...store.skills[idx],
    ...patch,
    id,
    builtin: store.skills[idx].builtin,
    updatedAt: new Date().toISOString(),
  });
  store.skills[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteSkill(id) {
  const store = readStore();
  const skill = store.skills.find((s) => s.id === id);
  if (!skill) return false;
  if (skill.builtin) {
    throw Object.assign(new Error("Cannot delete builtin skill"), { code: "forbidden" });
  }
  store.skills = store.skills.filter((s) => s.id !== id);
  writeStore(store);
  return true;
}

export function resetSkillsForTests() {
  writeStore({ skills: BUILTIN_SKILLS });
}
