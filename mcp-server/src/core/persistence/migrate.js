/**
 * Hub MSSQL migration runner
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "migrations");

const MIGRATION_FILES = [
  { version: 1, file: "001_hub_schema.sql" },
  { version: 2, file: "002_chat_conversations.sql" },
  { version: 3, file: "003_llm_usage.sql" },
  { version: 4, file: "004_agent_runs.sql" },
  { version: 5, file: "005_usage_context.sql" },
  { version: 6, file: "006_plugin_state.sql" },
  { version: 7, file: "007_workspace_preferences.sql" },
];

/**
 * @param {import("mssql").ConnectionPool} pool
 */
export async function runMigrations(pool) {
  const currentVersion = (await getSchemaVersion(pool)) ?? 0;
  const pending = MIGRATION_FILES.filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    return currentVersion;
  }
  for (const migration of pending) {
    const sqlPath = join(MIGRATIONS_DIR, migration.file);
    const sqlText = readFileSync(sqlPath, "utf8");
    await pool.request().batch(sqlText);
    console.log(`[persistence] Applied migration v${migration.version} (${migration.file})`);
  }
  return (await getSchemaVersion(pool)) ?? currentVersion;
}

/**
 * @param {import("mssql").ConnectionPool} pool
 * @returns {Promise<number|null>}
 */
export async function getSchemaVersion(pool) {
  try {
    const result = await pool.request().query(
      "SELECT MAX(version) AS version FROM hub_schema_version"
    );
    return result.recordset[0]?.version ?? null;
  } catch {
    return null;
  }
}
