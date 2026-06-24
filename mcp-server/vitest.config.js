import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
    exclude: [
      "**/node_modules/**",
      "tests/e2e.test.js",
      "tests/smoke.test.js",
      "tests/plugins/repo-intelligence.test.js",
      "tests/plugins/shell-hardened.test.js",
      "tests/plugins/project-orchestrator.test.js",
      "tests/plugins/shell-policy.integration.test.js",
      "tests/plugins/rag.test.js",
      "tests/plugins/llm-router.test.js",
      "tests/plugins/tech-detector.test.js",
      "tests/plugins/notion.test.js",
      "tests/plugins/code-review.test.js",
      "tests/plugins/local-sidecar.test.js",
      "tests/contract/llm-router.contract.test.js",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "cache/",
        "**/*.config.{js,ts}",
      ],
      thresholds: {
        // Core modules - strict requirements
        "src/core/**/*.js": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Plugin entry points - moderate requirements
        "src/plugins/*/index.js": {
          branches: 60,
          functions: 70,
          lines: 75,
          statements: 75,
        },
      },
    },
    pool: "forks",
  },
});
