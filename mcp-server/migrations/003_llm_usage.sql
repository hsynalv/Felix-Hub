-- Hub persistence schema v003 — LLM usage events
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'llm_usage_events')
BEGIN
  CREATE TABLE llm_usage_events (
    id                    BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_id              UNIQUEIDENTIFIER NOT NULL,
    occurred_at           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    namespace             NVARCHAR(64) NOT NULL DEFAULT 'default',

    source                NVARCHAR(32) NOT NULL,
    channel               NVARCHAR(32) NULL,
    tool_name             NVARCHAR(128) NULL,
    plugin_name           NVARCHAR(64) NULL,
    operation_type        NVARCHAR(32) NOT NULL,

    provider              NVARCHAR(32) NULL,
    model                 NVARCHAR(128) NULL,
    task                  NVARCHAR(64) NULL,

    prompt_tokens         INT NOT NULL DEFAULT 0,
    completion_tokens     INT NOT NULL DEFAULT 0,
    total_tokens          INT NOT NULL DEFAULT 0,
    estimated_cost_usd    DECIMAL(12,6) NULL,

    actor                 NVARCHAR(128) NULL,
    correlation_id        NVARCHAR(64) NULL,
    parent_correlation_id NVARCHAR(64) NULL,
    conversation_id       UNIQUEIDENTIFIER NULL,

    duration_ms           INT NULL,
    success               BIT NOT NULL DEFAULT 1,
    metadata_json         NVARCHAR(MAX) NULL,

    archived_at           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_usage_occurred ON llm_usage_events (occurred_at DESC);
  CREATE INDEX IX_usage_tool ON llm_usage_events (tool_name, occurred_at DESC);
  CREATE INDEX IX_usage_namespace_occurred ON llm_usage_events (namespace, occurred_at DESC);
  CREATE INDEX IX_usage_correlation ON llm_usage_events (correlation_id);
  CREATE INDEX IX_usage_conversation ON llm_usage_events (conversation_id, occurred_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 3)
  INSERT INTO hub_schema_version (version) VALUES (3);
