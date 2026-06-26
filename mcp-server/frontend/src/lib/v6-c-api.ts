import { apiGet, apiPost, apiPut, apiDelete } from "./api-client";

export interface AgentProduct {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  requiredIntegrations: string[];
  evalScore: number;
  trustScore: number;
  costEstimateUsd: number;
  installed: boolean;
}

export async function fetchAppStoreProducts() {
  const data = await apiGet<{ products: AgentProduct[] }>("/app-store/products");
  return data.products;
}

export async function previewAppInstall(productId: string) {
  return apiGet<unknown>(`/app-store/products/${productId}/preview`);
}

export async function installAppProduct(productId: string) {
  return apiPost<unknown>(`/app-store/products/${productId}/install`, { confirmPolicy: true });
}

export async function uninstallAppProduct(productId: string) {
  return apiPost<unknown>(`/app-store/products/${productId}/uninstall`, {});
}

export async function parseNLAdmin(command: string) {
  return apiPost<{ intentId: string; preview: { summary: string } }>("/nl-admin/parse", { command });
}

export async function executeNLAdmin(command: string) {
  return apiPost<unknown>("/nl-admin/execute", { command, confirm: true });
}

export async function fetchComplianceReport() {
  return apiGet<unknown>("/compliance/report");
}

export async function detectConflicts(topic: string) {
  return apiPost<{ conflicts: unknown[] }>("/conflicts/detect", { topic });
}

export async function fetchConflicts() {
  const data = await apiGet<{ conflicts: unknown[] }>("/conflicts");
  return data.conflicts;
}

export async function fetchOperatingPreferences() {
  const data = await apiGet<{ preferences: Array<{ id: string; key: string; value: unknown; pinned: boolean }> }>(
    "/operating-model/preferences"
  );
  return data.preferences;
}

export async function rememberPreference(key: string, value: string) {
  return apiPost<unknown>("/operating-model/remember", { key, value, scope: "global" });
}

export async function forgetPreference(id: string) {
  return apiDelete<unknown>(`/operating-model/preferences/${id}`);
}
