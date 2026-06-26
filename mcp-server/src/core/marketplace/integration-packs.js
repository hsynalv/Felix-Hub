/**
 * Integration packs — curated plugin bundles for team onboarding.
 */

export const INTEGRATION_PACKS = {
  developer: {
    id: "developer",
    name: "Developer Pack",
    description: "GitHub + git + shell + tests + code-review — yazılım geliştirme iş akışları",
    icon: "code",
    plugins: ["github", "git", "shell", "tests", "code-review", "workspace", "repo-intelligence"],
    tools: ["github_analyze_repo", "git_status", "tests_run", "code_review_file"],
    requiredEnv: {
      github: ["GITHUB_TOKEN"],
    },
  },
  knowledge: {
    id: "knowledge",
    name: "Knowledge Pack",
    description: "Notion + Obsidian + RAG + brain — bilgi tabanı ve bağlam",
    icon: "book",
    plugins: ["notion", "rag", "brain"],
    tools: ["notion_search", "rag_search", "brain_recall"],
    requiredEnv: {
      notion: ["NOTION_TOKEN"],
    },
  },
  ops: {
    id: "ops",
    name: "Ops Pack",
    description: "Observability + audit + policy + notifications",
    icon: "shield",
    plugins: ["observability", "policy", "notifications", "http"],
    tools: ["observability_health", "policy_list_rules", "notifications_send"],
    requiredEnv: {},
  },
  automation: {
    id: "automation",
    name: "Automation Pack",
    description: "n8n + http + secrets — otomasyon ve entegrasyon",
    icon: "zap",
    plugins: ["n8n", "n8n-workflows", "http", "secrets"],
    tools: ["n8n_list_workflows", "http_request", "secret_list"],
    requiredEnv: {
      n8n: ["N8N_BASE_URL"],
    },
  },
  desktop: {
    id: "desktop",
    name: "Desktop Pack",
    description: "Sidecar + terminal + desktop control + dosya sistemi",
    icon: "monitor",
    plugins: ["local-sidecar", "file-watcher"],
    tools: ["local_terminal_exec", "desktop_screenshot", "fs_list"],
    requiredEnv: {},
  },
};

export function listIntegrationPacks() {
  return Object.values(INTEGRATION_PACKS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    pluginCount: p.plugins.length,
    toolCount: p.tools.length,
  }));
}

export function getIntegrationPack(packId) {
  return INTEGRATION_PACKS[packId] || null;
}

/** Resolve pack plugin names against loaded plugin registry. */
export function resolvePackPlugins(packId, installedPlugins = []) {
  const pack = getIntegrationPack(packId);
  if (!pack) return { pack: null, resolved: [] };
  const names = new Set(installedPlugins.map((p) => p.name));
  const resolved = pack.plugins.map((name) => ({
    name,
    installed: names.has(name),
    missing: !names.has(name),
  }));
  return { pack, resolved, allInstalled: resolved.every((p) => p.installed) };
}
