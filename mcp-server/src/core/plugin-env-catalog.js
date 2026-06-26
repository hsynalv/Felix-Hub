/**
 * Documented environment variables per plugin for plugin.meta.json validation.
 * Plugins not listed here have no required external configuration.
 */

import { getEnvValue, getOverlay, listOverlayKeys } from "./settings/effective-config.js";
import { maskSecret } from "./settings/crypto.js";

const SENSITIVE_KEY = /KEY|TOKEN|SECRET|PASSWORD|URL|CONNECTION/i;

/** @type {Array<{ name: string, required?: boolean, description: string }>} */
export const CORE_ENV_CATALOG = [
  { name: "PORT", required: false, description: "HTTP server port" },
  { name: "NODE_ENV", required: false, description: "Node.js runtime environment" },
  { name: "HUB_READ_KEY", required: false, description: "Read-scope API key" },
  { name: "HUB_WRITE_KEY", required: false, description: "Write-scope API key" },
  { name: "HUB_ADMIN_KEY", required: false, description: "Admin-scope API key (Settings UI)" },
  { name: "HUB_PERSISTENCE_ENABLED", required: false, description: "Enable MSSQL persistence" },
  { name: "HUB_MSSQL_URL", required: false, description: "MSSQL connection for hub persistence" },
  { name: "HUB_SETTINGS_MASTER_KEY", required: false, description: "Master key for encrypted settings storage" },
  { name: "REDIS_URL", required: false, description: "Redis connection URL for jobs and cache" },
];

/** @type {Record<string, Array<{ name: string, required?: boolean, description: string }>>} */
export const PLUGIN_ENV_CATALOG = {
  brain: [
    { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key for brain LLM features" },
    { name: "BRAIN_LLM_API_KEY", required: false, description: "Alternate API key for brain LLM provider" },
    { name: "OBSIDIAN_VAULT_PATH", required: false, description: "Path to Obsidian vault for export/sync" },
    { name: "OBSIDIAN_EXPORT_ENABLED", required: false, description: "Enable Obsidian export integration" },
  ],
  database: [
    { name: "DATABASE_URL", required: false, description: "Default database connection URL" },
    { name: "MSSQL_CONNECTION_STRING", required: false, description: "MSSQL connection string" },
  ],
  docker: [
    { name: "DOCKER_HOST", required: false, description: "Docker daemon socket or host URL" },
  ],
  email: [
    { name: "SMTP_HOST", required: true, description: "SMTP server hostname" },
    { name: "SMTP_USER", required: true, description: "SMTP username" },
    { name: "SMTP_PASS", required: true, description: "SMTP password" },
    { name: "SMTP_PORT", required: false, description: "SMTP port (default 587)" },
  ],
  "file-storage": [
    { name: "FILE_STORAGE_LOCAL_ROOT", required: false, description: "Local filesystem root for stored files" },
    { name: "FILE_STORAGE_MAX_MB", required: false, description: "Maximum upload size in megabytes" },
    { name: "FILE_STORAGE_READONLY", required: false, description: "Disable destructive file operations when true" },
  ],
  http: [
    { name: "HTTP_ALLOWED_DOMAINS", required: false, description: "Comma-separated allowlist of outbound domains" },
    { name: "HTTP_BLOCKED_DOMAINS", required: false, description: "Comma-separated blocklist of outbound domains" },
    { name: "HTTP_RATE_LIMIT_RPM", required: false, description: "Per-plugin HTTP request rate limit per minute" },
  ],
  "image-gen": [
    { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key for DALL-E image generation" },
    { name: "STABILITY_API_KEY", required: false, description: "Stability AI API key for image generation" },
  ],
  marketplace: [
    { name: "ENABLE_MARKETPLACE", required: false, description: "Enable marketplace install/update routes" },
  ],
  n8n: [
    { name: "N8N_BASE_URL", required: false, description: "n8n instance base URL" },
    { name: "N8N_API_KEY", required: false, description: "n8n API key" },
    { name: "ALLOW_N8N_WRITE", required: false, description: "Allow mutating n8n operations" },
  ],
  "n8n-credentials": [
    { name: "N8N_API_KEY", required: true, description: "n8n API key for credential sync" },
    { name: "N8N_BASE_URL", required: false, description: "n8n instance base URL" },
  ],
  notifications: [
    { name: "TELEGRAM_BOT_TOKEN", required: false, description: "Telegram bot token for outbound messages" },
    { name: "TELEGRAM_WEBHOOK_SECRET", required: false, description: "Secret for Telegram webhook validation" },
    { name: "TELEGRAM_ALLOWED_CHAT_IDS", required: false, description: "Comma-separated allowed Telegram chat IDs" },
    { name: "TELEGRAM_POLLING", required: false, description: "Enable Telegram long-polling mode" },
  ],
  rag: [
    { name: "OPENAI_API_KEY", required: false, description: "Embedding provider API key" },
    { name: "RAG_VECTOR_STORE_PATH", required: false, description: "Path for local vector store persistence" },
  ],
  secrets: [
    { name: "HUB_SETTINGS_MASTER_KEY", required: false, description: "Master key for encrypted secret storage" },
  ],
  shell: [
    { name: "SHELL_ALLOWLIST", required: false, description: "Comma-separated allowed shell command prefixes" },
    { name: "SHELL_DEFAULT_TIMEOUT_MS", required: false, description: "Default command timeout in milliseconds" },
    { name: "SHELL_MAX_TIMEOUT_MS", required: false, description: "Maximum allowed command timeout" },
    { name: "ALLOWED_WORKING_DIRS", required: false, description: "Comma-separated allowed working directories" },
    { name: "SHELL_AUDIT_TYPE", required: false, description: "Audit sink type for shell operations" },
  ],
  slack: [
    { name: "SLACK_BOT_TOKEN", required: true, description: "Slack bot OAuth token" },
  ],
  "video-gen": [
    { name: "RUNWAY_API_KEY", required: false, description: "Runway ML API key" },
    { name: "PIKA_API_KEY", required: false, description: "Pika API key" },
    { name: "HEYGEN_API_KEY", required: false, description: "HeyGen API key" },
  ],
  notion: [
    { name: "NOTION_API_KEY", required: true, description: "Notion integration token" },
    { name: "NOTION_ROOT_PAGE_ID", required: false, description: "Üst sayfa ID (URL veya ?v= içeren link de olur — kayıtta temizlenir)" },
    { name: "NOTION_PROJECTS_DB_ID", required: false, description: "Projeler veritabanı ID (Notion URL yapıştırılabilir)" },
    { name: "NOTION_PROJECTS_DATA_SOURCE_ID", required: false, description: "Projeler data source ID (Notion 2025 API — otomatik bulunamazsa)" },
    { name: "NOTION_TASKS_DB_ID", required: false, description: "Görevler veritabanı ID (Notion URL yapıştırılabilir)" },
    { name: "NOTION_TASKS_DATA_SOURCE_ID", required: false, description: "Görevler data source ID (Notion 2025 API — otomatik bulunamazsa)" },
  ],
  "llm-router": [
    { name: "LLM_KEY_MODE", required: false, description: "unified (tek anahtar) veya split (ayrı atama)" },
    { name: "LLM_UNIFIED_API_KEY", required: false, description: "Birleşik OpenAI anahtarı (unified mod)" },
    { name: "CHAT_LLM_PROVIDER", required: false, description: "Sohbet sağlayıcısı: openai, vllm, ollama" },
    { name: "CHAT_LLM_MODEL", required: false, description: "Sohbet varsayılan modeli" },
    { name: "ROUTER_LLM_PROVIDER", required: false, description: "LLM router sağlayıcısı" },
    { name: "ROUTER_LLM_MODEL", required: false, description: "LLM router varsayılan modeli" },
    { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key" },
    { name: "OPENAI_CHAT_MODEL", required: false, description: "Varsayılan sohbet modeli (ör. gpt-4o-mini)" },
    { name: "ANTHROPIC_API_KEY", required: false, description: "Anthropic API key (isteğe bağlı)" },
    { name: "GOOGLE_API_KEY", required: false, description: "Google Gemini API key" },
    { name: "MISTRAL_API_KEY", required: false, description: "Mistral API key" },
    { name: "OLLAMA_BASE_URL", required: false, description: "Ollama local inference base URL" },
    { name: "OLLAMA_MODEL", required: false, description: "Ollama varsayılan model adı" },
    { name: "VLLM_BASE_URL", required: false, description: "vLLM / OpenAI-uyumlu sunucu URL" },
    { name: "VLLM_API_KEY", required: false, description: "vLLM sunucu API anahtarı (varsa)" },
    { name: "VLLM_MODEL", required: false, description: "vLLM varsayılan model adı" },
    { name: "VLLM_MODELS", required: false, description: "vLLM model listesi (virgülle ayrılmış)" },
  ],
  github: [
    { name: "GITHUB_TOKEN", required: false, description: "GitHub personal access token" },
  ],
};

/**
 * @param {unknown} envVars
 * @returns {Array<{ name: string, required: boolean, description: string }>}
 */
export function normalizeEnvVarEntries(envVars) {
  if (!Array.isArray(envVars)) return [];
  return envVars.map((entry) => {
    if (typeof entry === "string") {
      return { name: entry, required: false, description: "" };
    }
    return {
      name: entry.name,
      required: entry.required ?? false,
      description: entry.description || "",
    };
  });
}

/**
 * @param {string} pluginName
 * @param {unknown} envVars
 * @returns {string[]}
 */
export function getMissingCatalogEnvVars(pluginName, envVars) {
  const catalog = PLUGIN_ENV_CATALOG[pluginName];
  if (!catalog?.length) return [];

  const declared = new Set(normalizeEnvVarEntries(envVars).map((e) => e.name));
  return catalog.filter((expected) => !declared.has(expected.name)).map((e) => e.name);
}

/**
 * Check whether required catalog env vars are configured at runtime.
 * @param {string} pluginName
 */
export function getPluginEnvCompleteness(pluginName) {
  const catalog = PLUGIN_ENV_CATALOG[pluginName];
  if (!catalog?.length) return { complete: true, missing: [] };

  const missing = catalog
    .filter((v) => v.required)
    .filter((v) => !getVarRuntimeState(v.name).configured)
    .map((v) => v.name);

  return { complete: missing.length === 0, missing };
}

function maskKeyValue(key, value) {
  if (!value) return null;
  if (SENSITIVE_KEY.test(key)) return maskSecret(value);
  return value.length > 80 ? `${value.slice(0, 40)}…` : value;
}

function getVarRuntimeState(key) {
  const overlay = getOverlay();
  const value = getEnvValue(key);
  if (!value) {
    return { maskedValue: null, source: "unset", configured: false };
  }
  return {
    maskedValue: maskKeyValue(key, value),
    source: overlay.has(key) ? "overlay" : "env",
    configured: true,
  };
}

/**
 * @param {Array<{ name: string, version?: string, description?: string, tools?: Array<{ name: string }> }>} plugins
 * @param {Array<{ slug: string, displayName: string, envKeys?: string[], toolCount?: number }>} [mcpConnectors]
 */
export function listEnvCatalogEnriched(plugins = [], mcpConnectors = []) {
  const pluginMap = new Map(plugins.map((p) => [p.name, p]));
  const catalogKeys = new Set();

  const buildGroup = (pluginKey, vars, meta = {}) => {
    const pluginInfo = pluginMap.get(pluginKey);
    const toolNames = (pluginInfo?.tools || []).map((t) => t.name).filter(Boolean);
    return {
      plugin: pluginKey,
      label: meta.label || pluginKey,
      description: pluginInfo?.description || meta.description || "",
      version: pluginInfo?.version || null,
      tools: toolNames,
      toolCount: toolNames.length,
      vars: vars.map((v) => {
        catalogKeys.add(v.name);
        return {
          name: v.name,
          required: !!v.required,
          description: v.description || "",
          ...getVarRuntimeState(v.name),
        };
      }),
    };
  };

  const groups = [
    buildGroup("hub", CORE_ENV_CATALOG, {
      label: "Hub / Core",
      description: "Sunucu bootstrap, auth ve persistence ayarları",
    }),
    ...Object.entries(PLUGIN_ENV_CATALOG)
      .map(([plugin, vars]) => buildGroup(plugin, vars))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...mcpConnectors
      .filter((c) => Array.isArray(c.envKeys) && c.envKeys.length > 0)
      .map((connector) =>
        buildGroup(
          connector.slug,
          connector.envKeys.map((name) => ({
            name,
            required: true,
            description: `${connector.displayName} — dış MCP bağlantısı`,
          })),
          {
            label: `${connector.displayName} (Dış MCP)`,
            description: `Harici MCP: ${connector.slug}`,
          }
        )
      ),
  ];

  const unassigned = [];
  for (const key of listOverlayKeys()) {
    if (catalogKeys.has(key)) continue;
    unassigned.push({
      name: key,
      required: false,
      description: "Şifreli overlay — katalog dışı",
      ...getVarRuntimeState(key),
    });
  }
  unassigned.sort((a, b) => a.name.localeCompare(b.name));

  return { groups, unassigned };
}

/** Grouped env catalog for settings UI (legacy shape) */
export function listEnvCatalogGrouped() {
  return listEnvCatalogEnriched().groups
    .filter((g) => g.plugin !== "hub")
    .map(({ plugin, vars }) => ({
      plugin,
      vars: vars.map(({ name, required, description }) => ({ name, required, description })),
    }));
}
