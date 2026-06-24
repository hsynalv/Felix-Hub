-- Hub persistence schema v005 — usage attribution + quotas + context events
-- Idempotent: safe to re-run

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('llm_usage_events') AND name = 'run_id'
)
BEGIN
  ALTER TABLE llm_usage_events ADD run_id UNIQUEIDENTIFIER NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('llm_usage_events') AND name = 'project_id'
)
BEGIN
  ALTER TABLE llm_usage_events ADD project_id NVARCHAR(64) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_usage_run' AND object_id = OBJECT_ID('llm_usage_events')
)
BEGIN
  CREATE INDEX IX_usage_run ON llm_usage_events (run_id, occurred_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_usage_project' AND object_id = OBJECT_ID('llm_usage_events')
)
BEGIN
  CREATE INDEX IX_usage_project ON llm_usage_events (project_id, occurred_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usage_quotas')
BEGIN
  CREATE TABLE usage_quotas (
    id              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    scope_type      NVARCHAR(32) NOT NULL,
    scope_id        NVARCHAR(128) NOT NULL DEFAULT '*',
    period          NVARCHAR(16) NOT NULL DEFAULT 'monthly',
    limit_tokens    BIGINT NULL,
    limit_usd       DECIMAL(12,4) NULL,
    alert_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.8,
    hard_stop       BIT NOT NULL DEFAULT 0,
    enabled         BIT NOT NULL DEFAULT 1,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_usage_quotas_scope ON usage_quotas (scope_type, scope_id, period);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'context_events')
BEGIN
  CREATE TABLE context_events (
    id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    project_id   NVARCHAR(64) NOT NULL,
    event_type   NVARCHAR(32) NOT NULL,
    summary      NVARCHAR(512) NULL,
    refs_json    NVARCHAR(MAX) NULL,
    occurred_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_context_events_project ON context_events (project_id, occurred_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 5)
  INSERT INTO hub_schema_version (version) VALUES (5);
