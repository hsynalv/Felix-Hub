import { apiGet, apiPost } from "./api-client";

export interface MarketplacePlugin {
  name: string;
  version?: string;
  description?: string;
  enabled?: boolean;
  maturity?: string;
  riskLevel?: string | null;
  tools?: Array<{ name: string; description?: string }>;
  state?: {
    enabled: boolean;
    lastHealth?: string | null;
    lastVerifiedAt?: string | null;
    envComplete?: boolean;
  };
  missingEnv?: string[];
}

export interface PluginWizard {
  plugin: string;
  description?: string;
  maturity?: string;
  security?: Record<string, unknown>;
  steps: Array<{ id: string; title: string; [key: string]: unknown }>;
}

export async function fetchMarketplaceCatalog() {
  return apiGet<{ plugins: MarketplacePlugin[]; count: number }>("/marketplace/catalog");
}

export async function fetchPluginWizard(pluginName: string) {
  return apiGet<PluginWizard>(`/marketplace/plugins/${encodeURIComponent(pluginName)}/wizard`);
}

export async function enablePlugin(pluginName: string) {
  return apiPost<MarketplacePlugin>(`/marketplace/plugins/${encodeURIComponent(pluginName)}/enable`, {});
}

export async function disablePlugin(pluginName: string) {
  return apiPost<MarketplacePlugin>(`/marketplace/plugins/${encodeURIComponent(pluginName)}/disable`, {});
}

export async function testPluginConnection(pluginName: string) {
  return apiPost<{ ok: boolean; message?: string; missing?: string[] }>(
    `/marketplace/plugins/${encodeURIComponent(pluginName)}/test`,
    {}
  );
}
