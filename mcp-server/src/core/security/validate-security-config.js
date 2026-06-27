/**
 * Fail-closed startup checks for security-related environment (production).
 */

import { getSecurityRuntime, hubKeysConfigured } from "./resolve-runtime-security.js";
import { getEnvValue } from "../settings/effective-config.js";

function envIsTrue(name) {
  const v = process.env[name];
  return v === "true" || v === "1";
}

function fail(message) {
  console.error(`\n❌ Security: ${message}\n`);
  process.exit(1);
}

/**
 * Pre-route startup validation.
 */
export function validateSecurityConfigOrExit() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return;
  }

  const rt = getSecurityRuntime();

  if (rt.isProduction && rt.allowOpenHub) {
    fail("HUB_ALLOW_OPEN_HUB cannot be enabled when NODE_ENV=production.");
  }

  if (rt.isProduction && !hubKeysConfigured() && !process.env.OAUTH_INTROSPECTION_ENDPOINT?.trim()) {
    fail("production requires HUB_READ_KEY/HUB_WRITE_KEY/HUB_ADMIN_KEY and/or OAUTH_INTROSPECTION_ENDPOINT.");
  }

  if (rt.isProduction && process.env.HUB_AUTH_ENABLED === "false") {
    fail("HUB_AUTH_ENABLED=false is not allowed in production (fail-closed hub HTTP/STDIO).");
  }

  if (rt.isProduction) {
    if (!process.env.CORS_ALLOWED_ORIGINS?.trim()) {
      fail("CORS_ALLOWED_ORIGINS is required in production (comma-separated UI origins).");
    }

    if (rt.policyAllowMissingEvaluator) {
      fail(
        "POLICY_ALLOW_MISSING_EVALUATOR / TOOL_POLICY_ALLOW_MISSING_EVALUATOR / POLICY_GUARD_ALLOW_MISSING_EVALUATOR cannot be true in production."
      );
    }

    if (!envIsTrue("WORKSPACE_STRICT_BOUNDARIES")) {
      fail("WORKSPACE_STRICT_BOUNDARIES=true is required in production.");
    }

    if (!envIsTrue("WORKSPACE_REQUIRE_ID")) {
      fail("WORKSPACE_REQUIRE_ID=true is required in production.");
    }

    const chatProvider = (getEnvValue("CHAT_LLM_PROVIDER") || process.env.CHAT_LLM_PROVIDER || "").trim().toLowerCase();
    if (!chatProvider || chatProvider === "auto") {
      fail("CHAT_LLM_PROVIDER must be set explicitly in production (not auto).");
    }

    const chatModel =
      (getEnvValue("CHAT_LLM_MODEL") || process.env.CHAT_LLM_MODEL || process.env.OPENAI_CHAT_MODEL || "").trim();
    if (!chatModel) {
      fail("CHAT_LLM_MODEL (or OPENAI_CHAT_MODEL for OpenAI) is required in production.");
    }

    const shellMode = (process.env.SHELL_MODE || "safe").trim().toLowerCase();
    if (shellMode !== "safe" && shellMode !== "power") {
      fail('SHELL_MODE must be "safe" or "power" in production.');
    }
  }
}

/**
 * Post-plugin-load validation (policy evaluator must be registered in production).
 */
export async function validateSecurityAfterPluginsOrExit() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return;
  }

  const rt = getSecurityRuntime();
  if (!rt.isProduction) return;

  const { getPolicyEvaluator } = await import("../policy-hooks.js");
  if (!getPolicyEvaluator()) {
    fail("Policy plugin must be loaded in production (policy evaluator missing).");
  }
}
