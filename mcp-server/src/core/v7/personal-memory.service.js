/**
 * V7 — Personal memory profile (wraps V6 operating model).
 */

import {
  listPreferences,
  rememberPreference,
  forgetPreference,
  pinPreference,
  exportOperatingModel,
  getOperatingModelPromptContext,
} from "../v6-c/operating-model-store.js";

export function listPersonalMemory({ scope = null, projectId = null } = {}) {
  return listPreferences({ scope, projectId });
}

export function rememberPersonal({ key, value, scope = "global", projectId = null, pinned = false }) {
  return rememberPreference({ key, value, scope, projectId, pinned, source: "explicit" });
}

export function forgetPersonal(id) {
  return forgetPreference(id);
}

export function pinPersonal(id, pinned = true) {
  return pinPreference(id, pinned);
}

export function exportPersonalMemory() {
  return exportOperatingModel();
}

export function getPersonalMemoryPromptContext() {
  return getOperatingModelPromptContext();
}
