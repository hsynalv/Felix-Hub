let projectId = "default";
let projectEnv = "development";

type Listener = () => void;
const listeners = new Set<Listener>();

export function getProjectId() {
  return projectId;
}

export function getProjectEnv() {
  return projectEnv;
}

export function getProjectHeaders(): Record<string, string> {
  return {
    "x-project-id": projectId,
    "x-env": projectEnv,
  };
}

export function setWorkspaceContext(next: { projectId: string; projectEnv: string }) {
  projectId = next.projectId.trim() || "default";
  projectEnv = next.projectEnv.trim() || "development";
  listeners.forEach((fn) => fn());
}

export function subscribeWorkspaceContext(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
