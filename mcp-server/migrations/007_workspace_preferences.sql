-- Hub persistence schema v007 — per-actor workspace preferences (project + env)
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'workspace_preferences')
BEGIN
  CREATE TABLE workspace_preferences (
    actor_id        NVARCHAR(64)   NOT NULL PRIMARY KEY,
    project_id      NVARCHAR(128)  NOT NULL DEFAULT 'default',
    project_env     NVARCHAR(32)   NOT NULL DEFAULT 'development',
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_workspace_prefs_updated ON workspace_preferences (updated_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 7)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (7);
END;
