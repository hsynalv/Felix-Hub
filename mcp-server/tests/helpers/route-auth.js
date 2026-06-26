/**
 * Mount unified security middleware for isolated route unit tests.
 */
import { enforceSecurityContext } from "../../src/core/security/enforce-security-context.js";

export function withHubSecurityMiddleware(app) {
  app.use(enforceSecurityContext);
  return app;
}
