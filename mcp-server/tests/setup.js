/**
 * Vitest global setup — fast defaults for unit/integration tests.
 * Set HUB_TEST_PERSISTENCE=true to opt into real MSSQL during tests.
 */

if (process.env.HUB_TEST_PERSISTENCE !== "true") {
  process.env.HUB_PERSISTENCE_ENABLED = "false";
  delete process.env.HUB_MSSQL_URL;
}

process.env.NODE_ENV = process.env.NODE_ENV || "test";
if (process.env.SCHEDULE_RUNNER_ENABLED == null) {
  process.env.SCHEDULE_RUNNER_ENABLED = "false";
}
if (process.env.SLA_RUNNER_ENABLED == null) {
  process.env.SLA_RUNNER_ENABLED = "false";
}
