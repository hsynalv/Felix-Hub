import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveEffectiveTenantId,
  assertTenantBoundary,
} from "../../src/core/authorization/assert-tenant-boundary.js";
import { getSecurityRuntime } from "../../src/core/security/resolve-runtime-security.js";

describe("assert-tenant-boundary", () => {
  const prevTenant = process.env.HUB_TENANT_ID;
  const prevRequire = process.env.HUB_REQUIRE_TENANT_ID;

  afterEach(() => {
    if (prevTenant === undefined) delete process.env.HUB_TENANT_ID;
    else process.env.HUB_TENANT_ID = prevTenant;
    if (prevRequire === undefined) delete process.env.HUB_REQUIRE_TENANT_ID;
    else process.env.HUB_REQUIRE_TENANT_ID = prevRequire;
  });

  it("resolveEffectiveTenantId prefers context over env", () => {
    process.env.HUB_TENANT_ID = "env-tenant";
    expect(resolveEffectiveTenantId({ tenantId: "ctx-tenant" })).toBe("ctx-tenant");
  });

  it("resolveEffectiveTenantId falls back to HUB_TENANT_ID", () => {
    process.env.HUB_TENANT_ID = "default-tenant";
    expect(resolveEffectiveTenantId({})).toBe("default-tenant");
  });

  it("assertTenantBoundary allows when HUB_TENANT_ID is set", () => {
    process.env.HUB_REQUIRE_TENANT_ID = "true";
    process.env.HUB_TENANT_ID = "prod-tenant";
    const runtime = { ...getSecurityRuntime(), requireTenantId: true };
    expect(assertTenantBoundary({}, runtime)).toBeNull();
  });

  it("assertTenantBoundary denies when tenant missing and required", () => {
    process.env.HUB_REQUIRE_TENANT_ID = "true";
    delete process.env.HUB_TENANT_ID;
    const runtime = { ...getSecurityRuntime(), requireTenantId: true };
    const deny = assertTenantBoundary({}, runtime);
    expect(deny?.error?.code).toBe("missing_tenant_context");
  });
});
