/**
 * LLM routing & key mode — unified (single OpenAI key) vs split (chat vs router assignment)
 */

import { getEnvValue } from "./settings/effective-config.js";
import { maskSecret } from "./settings/crypto.js";

export const LLM_KEY_MODES = ["unified", "split"];
export const CHAT_PROVIDERS = ["auto", "openai", "vllm", "ollama"];
export const ROUTER_PROVIDERS = ["auto", "openai", "anthropic", "google", "mistral", "vllm", "ollama"];

const PROVIDER_KEY_ENV = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.0-flash",
  mistral: "mistral-small-latest",
  vllm: "custom-model",
  ollama: "llama3.3",
};

export function getLlmKeyMode() {
  const mode = getEnvValue("LLM_KEY_MODE")?.trim().toLowerCase();
  return mode === "unified" ? "unified" : "split";
}

export function getUnifiedApiKey() {
  return (
    getEnvValue("LLM_UNIFIED_API_KEY")?.trim() ||
    getEnvValue("OPENAI_API_KEY")?.trim() ||
    ""
  );
}

/** Effective API key for a cloud provider (respects unified vs split mode) */
export function getProviderApiKey(provider) {
  if (provider === "vllm") {
    return getEnvValue("VLLM_API_KEY")?.trim() || "not-needed";
  }
  if (getLlmKeyMode() === "unified") {
    return provider === "openai" ? getUnifiedApiKey() : "";
  }
  const envKey = PROVIDER_KEY_ENV[provider];
  if (!envKey) return "";
  return getEnvValue(envKey)?.trim() || "";
}

export function getChatProviderPreference() {
  if (getLlmKeyMode() === "unified") return "openai";
  const p = getEnvValue("CHAT_LLM_PROVIDER")?.trim().toLowerCase();
  return CHAT_PROVIDERS.includes(p) && p !== "auto" ? p : "auto";
}

export function getRouterProviderPreference() {
  if (getLlmKeyMode() === "unified") return "openai";
  const p = getEnvValue("ROUTER_LLM_PROVIDER")?.trim().toLowerCase();
  return ROUTER_PROVIDERS.includes(p) && p !== "auto" ? p : "auto";
}

export function getChatDefaultModel() {
  return (
    getEnvValue("CHAT_LLM_MODEL")?.trim() ||
    getEnvValue("OPENAI_CHAT_MODEL")?.trim() ||
    defaultModelForProvider(getResolvedChatProvider())
  );
}

export function getRouterDefaultModel(provider) {
  const p = provider || getRouterProviderPreference();
  return (
    getEnvValue("ROUTER_LLM_MODEL")?.trim() ||
    (p === "vllm" ? getEnvValue("VLLM_MODEL")?.trim() : null) ||
    defaultModelForProvider(p)
  );
}

export function defaultModelForProvider(provider) {
  if (provider === "vllm") {
    return getEnvValue("VLLM_MODEL")?.trim() || DEFAULT_MODELS.vllm;
  }
  if (provider === "ollama") {
    return getEnvValue("OLLAMA_MODEL")?.trim() || DEFAULT_MODELS.ollama;
  }
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

export function isProviderKeyConfigured(provider) {
  if (getLlmKeyMode() === "unified") {
    return provider === "openai" && !!getUnifiedApiKey();
  }
  if (provider === "ollama") return true;
  if (provider === "vllm") return !!getEnvValue("VLLM_BASE_URL")?.trim();
  return !!getProviderApiKey(provider);
}

/** Resolved chat backend after applying assignment + auto detection */
export function getResolvedChatProvider() {
  const pref = getChatProviderPreference();
  if (pref !== "auto") {
    if (pref === "openai" && isProviderKeyConfigured("openai")) return "openai";
    if (pref === "vllm" && isProviderKeyConfigured("vllm")) return "vllm";
    if (pref === "ollama") return "ollama";
    return pref;
  }
  if (isProviderKeyConfigured("openai")) return "openai";
  if (isProviderKeyConfigured("vllm")) return "vllm";
  return "ollama";
}

export function getLlmConfigSnapshot() {
  const mode = getLlmKeyMode();
  const chatProvider = getChatProviderPreference();
  const routerProvider = getRouterProviderPreference();
  const resolvedChat = getResolvedChatProvider();

  const providerStatus = (id) => ({
    id,
    keyConfigured: isProviderKeyConfigured(id),
    maskedKey: maskProviderKey(id),
  });

  return {
    mode,
    globalInstructions: (getEnvValue("CHAT_GLOBAL_INSTRUCTIONS") || "").trim(),
    unified: {
      configured: !!getUnifiedApiKey(),
      maskedKey: getUnifiedApiKey() ? maskSecret(getUnifiedApiKey()) : null,
      model: getChatDefaultModel(),
    },
    chat: {
      provider: chatProvider,
      resolvedProvider: resolvedChat,
      model: getChatDefaultModel(),
      configured:
        resolvedChat === "ollama" ||
        (resolvedChat === "openai" && isProviderKeyConfigured("openai")) ||
        (resolvedChat === "vllm" && isProviderKeyConfigured("vllm")),
    },
    router: {
      provider: routerProvider,
      model: getRouterDefaultModel(routerProvider === "auto" ? null : routerProvider),
      configured:
        routerProvider === "auto" ||
        routerProvider === "ollama" ||
        isProviderKeyConfigured(routerProvider),
    },
    providers: ["openai", "anthropic", "google", "mistral", "vllm", "ollama"].map(providerStatus),
    chatProviders: CHAT_PROVIDERS.filter((p) => p !== "auto"),
    routerProviders: ROUTER_PROVIDERS.filter((p) => p !== "auto"),
  };
}

function maskProviderKey(provider) {
  if (provider === "vllm") {
    const url = getEnvValue("VLLM_BASE_URL");
    return url ? maskSecret(url) : null;
  }
  if (provider === "ollama") {
    return getEnvValue("OLLAMA_BASE_URL") || "http://localhost:11434";
  }
  const key = getProviderApiKey(provider);
  return key ? maskSecret(key) : null;
}
