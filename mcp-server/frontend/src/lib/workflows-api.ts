import { apiGet, apiPost, apiPut } from "./api-client";

export interface WorkflowStep {
  type: "tool" | "checkpoint" | "approval" | "branch";
  toolName?: string;
  name?: string;
  args?: Record<string, unknown>;
  when?: string;
  maxRetries?: number;
}

export interface WorkflowDraft {
  id?: string;
  name: string;
  description?: string;
  version?: number;
  parameters: Array<{ name: string; type?: string; required?: boolean; description?: string; default?: string }>;
  steps: WorkflowStep[];
  readonly?: boolean;
  builtin?: boolean;
}

export async function listWorkflowTemplatesFull() {
  return apiGet<{ templates: WorkflowDraft[] }>("/runs/templates/list");
}

export async function getWorkflowTemplate(id: string) {
  return apiGet<WorkflowDraft>(`/runs/templates/${id}`);
}

export async function saveWorkflowTemplate(draft: WorkflowDraft) {
  if (draft.id && !draft.builtin) {
    return apiPut<WorkflowDraft>(`/runs/templates/${draft.id}`, draft);
  }
  return apiPost<WorkflowDraft>("/runs/templates", draft);
}

export async function previewWorkflowTemplate(id: string, parameters: Record<string, string>, dryRun = true) {
  return apiPost<{ plan: unknown; dryRun: boolean }>(`/runs/templates/${id}/preview`, { parameters, dryRun });
}

export async function listToolsForDesigner() {
  return apiGet<{ tools: Array<{ name: string; description: string; plugin?: string; tags?: string[] }> }>(
    "/tools"
  );
}
