/**
 * enforceSecurityContext — session user namespace must survive principal attachment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { enforceSecurityContext } from "../../src/core/security/enforce-security-context.js";

vi.mock("../../src/core/security/resolve-principal.js", () => ({
  resolveHubPrincipalFromRequest: vi.fn(),
}));

vi.mock("../../src/core/security/resolve-runtime-security.js", () => ({
  getSecurityRuntime: vi.fn(() => ({ allowOpenPrincipal: false })),
}));

import { resolveHubPrincipalFromRequest } from "../../src/core/security/resolve-principal.js";

describe("enforceSecurityContext session user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not replace req.user object with principal display string", async () => {
    const userId = "7AA25E53-0834-41C3-A802-ECC6F1863B7F";
    const namespace = `user:${userId}`;

    resolveHubPrincipalFromRequest.mockImplementation(async (req) => {
      req.user = {
        userId,
        email: "hhsynalv@gmail.com",
        displayName: "Test",
        namespace,
        scopes: ["read", "write", "admin"],
      };
      return {
        authenticated: true,
        scopes: ["read", "write", "admin"],
        actor: {
          type: "user",
          userId,
          email: "hhsynalv@gmail.com",
          namespace,
          scopes: ["read", "write", "admin"],
        },
        user: "hhsynalv@gmail.com",
        authType: "session",
      };
    });

    const app = express();
    app.use(enforceSecurityContext);
    app.get("/probe", (req, res) => {
      res.json({
        namespace: req.user?.namespace ?? null,
        userType: typeof req.user,
      });
    });

    const res = await request(app).get("/probe").set("Accept", "application/json");
    expect(res.status).toBe(200);
    expect(res.body.namespace).toBe(namespace);
    expect(res.body.userType).toBe("object");
  });
});
