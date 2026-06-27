/**
 * Spec session file store — cache/spec-sessions/*.json
 */

import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

function getBaseDir() {
  return join(process.env.CATALOG_CACHE_DIR || "./cache", "spec-sessions");
}

async function ensureDir() {
  const base = getBaseDir();
  try {
    await access(base);
  } catch {
    await mkdir(base, { recursive: true });
  }
}

function sessionPath(id) {
  return join(getBaseDir(), `${id}.json`);
}

/**
 * @param {{ title?: string; idea?: string; projectId?: string | null }} input
 */
export async function createSpecSession(input = {}) {
  await ensureDir();
  const id = randomUUID();
  const now = new Date().toISOString();
  const session = {
    id,
    title: (input.title || "Untitled feature").trim().slice(0, 200),
    idea: (input.idea || "").trim().slice(0, 8000),
    projectId: input.projectId || null,
    stage: "requirements",
    artifacts: {},
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(sessionPath(id), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function getSpecSession(id) {
  try {
    const raw = await readFile(sessionPath(id), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveSpecSession(session) {
  await ensureDir();
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function listSpecSessions({ projectId = null, limit = 50 } = {}) {
  await ensureDir();
  const base = getBaseDir();
  const files = (await readdir(base)).filter((f) => f.endsWith(".json"));
  const sessions = [];
  for (const file of files) {
    try {
      const raw = await readFile(join(base, file), "utf8");
      const s = JSON.parse(raw);
      if (projectId && s.projectId !== projectId) continue;
      sessions.push({
        id: s.id,
        title: s.title,
        stage: s.stage,
        projectId: s.projectId,
        updatedAt: s.updatedAt,
        artifactStages: Object.keys(s.artifacts || {}),
      });
    } catch {
      /* skip corrupt */
    }
  }
  return sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, limit);
}
