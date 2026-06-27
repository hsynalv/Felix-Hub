import { describe, it, expect } from "vitest";
import {
  listEnvCatalogEnriched,
  listIntegrationsEnvCatalog,
  isIntegrationsEnvKey,
} from "../../src/core/plugin-env-catalog.js";

describe("plugin-env-catalog integrations scope", () => {
  it("excludes hub, llm-router and secrets from integrations catalog", () => {
    const full = listEnvCatalogEnriched([], []);
    const integrations = listIntegrationsEnvCatalog([], []);

    expect(full.groups.some((g) => g.plugin === "hub")).toBe(true);
    expect(integrations.groups.some((g) => g.plugin === "hub")).toBe(false);
    expect(integrations.groups.some((g) => g.plugin === "llm-router")).toBe(false);
    expect(integrations.groups.some((g) => g.plugin === "secrets")).toBe(false);
    expect(integrations.groups.some((g) => g.plugin === "notion")).toBe(true);
    expect(integrations.groups.some((g) => g.plugin === "notifications")).toBe(true);
  });

  it("strips bootstrap keys from plugin groups", () => {
    const integrations = listIntegrationsEnvCatalog([], []);
    const database = integrations.groups.find((g) => g.plugin === "database");
    expect(database?.vars.some((v) => v.name === "MSSQL_CONNECTION_STRING")).toBe(false);
    expect(database?.vars.some((v) => v.name === "DATABASE_URL")).toBe(true);
  });

  it("filters bootstrap and llm keys from unassigned", () => {
    expect(isIntegrationsEnvKey("PORT")).toBe(false);
    expect(isIntegrationsEnvKey("HUB_ADMIN_KEY")).toBe(false);
    expect(isIntegrationsEnvKey("OPENAI_API_KEY")).toBe(false);
    expect(isIntegrationsEnvKey("TELEGRAM_BOT_TOKEN")).toBe(true);
    expect(isIntegrationsEnvKey("NOTION_API_KEY")).toBe(true);
  });
});
