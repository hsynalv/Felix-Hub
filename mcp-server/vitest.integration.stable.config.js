import { defineConfig } from "vitest/config";

/**
 * Stable integration subset — runs in CI integration job.
 * Full env-heavy suite: vitest.integration.config.js
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/plugin-loader.test.js",
      "tests/jobs-api.test.js",
      "tests/plugins/database.test.js",
      "tests/plugins/secrets.test.js",
      "tests/plugins/image-gen.test.js",
      "tests/plugins/notifications.test.js",
      "tests/plugins/shell.test.js",
      "tests/contract/llm-router.contract.test.js",
    ],
    exclude: ["**/node_modules/**"],
    pool: "forks",
    testTimeout: 60_000,
  },
});
