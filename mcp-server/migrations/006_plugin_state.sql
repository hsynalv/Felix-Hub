-- Hub persistence schema v006 — plugin marketplace state
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'plugin_state')
BEGIN
  CREATE TABLE plugin_state (
    plugin_name     NVARCHAR(64) NOT NULL PRIMARY KEY,
    enabled         BIT NOT NULL DEFAULT 1,
    enabled_at      DATETIME2 NULL,
    enabled_by      NVARCHAR(128) NULL,
    last_health     NVARCHAR(16) NULL,
    last_verified_at DATETIME2 NULL,
    env_complete    BIT NOT NULL DEFAULT 1,
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_plugin_state_enabled ON plugin_state (enabled);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 6)
  INSERT INTO hub_schema_version (version) VALUES (6);
