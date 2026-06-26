import { apiDelete, apiGet, apiPost, apiPut } from "./api-client";

export interface McpConnector {
  id: string;
  slug: string;
  displayName: string;
  command: string;
  args: string[];
  envKeys: string[];
  enabled: boolean;
  lastHealth?: string | null;
  lastVerifiedAt?: string | null;
  toolCount: number;
  lastError?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpConnectorTemplate {
  id: string;
  displayName: string;
  slug: string;
  command: string;
  args: string[];
  envKeys: string[];
}

export interface McpConnectorInput {
  slug: string;
  displayName: string;
  command: string;
  args: string[];
  envKeys?: string[];
}

export async function fetchMcpConnectors() {
  return apiGet<{ connectors: McpConnector[] }>("/mcp-connectors");
}

export async function fetchMcpConnectorTemplates() {
  return apiGet<{ templates: McpConnectorTemplate[] }>("/mcp-connectors/templates");
}

export async function createMcpConnector(input: McpConnectorInput) {
  return apiPost<{ connector: McpConnector }>("/mcp-connectors", input);
}

export async function updateMcpConnector(id: string, input: Partial<McpConnectorInput>) {
  return apiPut<{ connector: McpConnector }>(`/mcp-connectors/${encodeURIComponent(id)}`, input);
}

export async function deleteMcpConnector(id: string) {
  return apiDelete<{ deleted: boolean }>(`/mcp-connectors/${encodeURIComponent(id)}`);
}

export async function testMcpConnector(id: string, envOverrides?: Record<string, string>) {
  return apiPost<{ ok: boolean; toolCount?: number; tools?: string[]; error?: string }>(
    `/mcp-connectors/${encodeURIComponent(id)}/test`,
    envOverrides ? { envOverrides } : {}
  );
}

export async function enableMcpConnector(id: string) {
  return apiPost<{ connector: McpConnector; toolCount?: number; tools?: string[] }>(
    `/mcp-connectors/${encodeURIComponent(id)}/enable`,
    {}
  );
}

export async function disableMcpConnector(id: string) {
  return apiPost<{ connector: McpConnector }>(`/mcp-connectors/${encodeURIComponent(id)}/disable`, {});
}
