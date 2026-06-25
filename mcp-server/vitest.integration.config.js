import { defineConfig } from "vitest/config";

/**
 * Integration / env-heavy tests — run via `pnpm run test:integration`.
 * Kept separate from the fast unit suite in vitest.config.js.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/plugin-loader.test.js",
      "tests/jobs-api.test.js",
      "tests/plugins/repo-intelligence.test.js",
      "tests/plugins/shell-hardened.test.js",
      "tests/plugins/project-orchestrator.test.js",
      "tests/plugins/shell-policy.integration.test.js",
      "tests/plugins/shell.test.js",
      "tests/plugins/rag.test.js",
      "tests/plugins/llm-router.test.js",
      "tests/plugins/tech-detector.test.js",
      "tests/plugins/notion.test.js",
      "tests/plugins/code-review.test.js",
      "tests/plugins/notifications.test.js",
      "tests/plugins/local-sidecar.test.js",
      "tests/plugins/image-gen.test.js",
      "tests/contract/llm-router.contract.test.js",
      "tests/plugins/database.test.js",
      "tests/plugins/secrets.test.js",
      "tests/e2e.test.js",
      "tests/smoke.test.js",
    ],
    exclude: ["**/node_modules/**"],
    pool: "forks",
    testTimeout: 30_000,
    setupFiles: ["tests/setup.js"],
  },
});
