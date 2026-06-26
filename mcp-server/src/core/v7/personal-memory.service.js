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
  getPreferenceById,
  updatePreferenceById,
} from "../v6-c/operating-model-store.js";

const SOURCE_EXPLANATIONS = {
  explicit: "Siz doğrudan kaydettiniz (/remember veya Bugün sayfası).",
  nl_admin: "Doğal dil admin komutu ile kaydedildi.",
  agent: "Agent bir konuşma sırasında öğrendi.",
  import: "Dışa/içe aktarım ile eklendi.",
};

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

export function updatePersonalMemory(id, { key, value } = {}) {
  const updated = updatePreferenceById(id, { key, value });
  if (!updated) {
    throw Object.assign(new Error("Preference not found"), { code: "not_found" });
  }
  return updated;
}

/**
 * why_do_you_know_this — explain provenance of a memory entry.
 */
export function explainPersonalMemory(id) {
  const pref = getPreferenceById(id);
  if (!pref) {
    return { ok: false, error: { code: "not_found", message: "Memory entry not found" } };
  }
  const sourceKey = pref.source || "explicit";
  return {
    ok: true,
    data: {
      id: pref.id,
      key: pref.key,
      value: pref.value,
      scope: pref.scope,
      projectId: pref.projectId,
      pinned: pref.pinned,
      source: sourceKey,
      explanation: SOURCE_EXPLANATIONS[sourceKey] || "Kaynak bilinmiyor.",
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
      editable: !pref.pinned || sourceKey === "explicit",
    },
  };
}

export function exportPersonalMemory() {
  return exportOperatingModel();
}

export function getPersonalMemoryPromptContext() {
  return getOperatingModelPromptContext();
}
