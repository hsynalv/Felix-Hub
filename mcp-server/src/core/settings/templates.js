/**
 * One-click connection / env skeleton templates
 */

export const TEMPLATES = {
  "openai-notion-mssql": {
    id: "openai-notion-mssql",
    label: "OpenAI + Notion + MSSQL",
    settings: [
      { keyName: "OPENAI_API_KEY", placeholder: "" },
      { keyName: "NOTION_API_KEY", placeholder: "" },
      { keyName: "NOTION_ROOT_PAGE_ID", placeholder: "" },
      { keyName: "HUB_MSSQL_URL", placeholder: "" },
    ],
    profiles: [
      { profileName: "openai-default", profileType: "openai", config: { model: "gpt-4o-mini" }, isDefault: true },
      { profileName: "notion-default", profileType: "notion", config: {}, isDefault: true },
      { profileName: "mssql-default", profileType: "mssql", config: { database: "personal-assistant" }, isDefault: true },
    ],
  },
  "minimal-redis": {
    id: "minimal-redis",
    label: "Minimal Redis",
    settings: [{ keyName: "REDIS_URL", placeholder: "redis://localhost:6379" }],
    profiles: [
      { profileName: "redis-default", profileType: "redis", config: { url: "redis://localhost:6379" }, isDefault: true },
    ],
  },
};

export function getTemplate(id) {
  return TEMPLATES[id] || null;
}

export function listTemplates() {
  return Object.values(TEMPLATES).map((t) => ({ id: t.id, label: t.label, settingsCount: t.settings.length, profilesCount: t.profiles.length }));
}

export async function applyTemplate(id, { upsertSetting, upsertConnectionProfile }) {
  const tpl = getTemplate(id);
  if (!tpl) {
    throw Object.assign(new Error(`Unknown template: ${id}`), { code: "template_not_found" });
  }
  const applied = { settings: [], profiles: [] };
  for (const s of tpl.settings) {
    await upsertSetting(s.keyName, s.placeholder || "", { updatedBy: "template" });
    applied.settings.push(s.keyName);
  }
  for (const p of tpl.profiles) {
    const row = await upsertConnectionProfile({
      profileName: p.profileName,
      profileType: p.profileType,
      config: p.config,
      isDefault: p.isDefault,
      isActive: true,
    });
    applied.profiles.push(row.profileName);
  }
  return { templateId: id, applied };
}
