-- Hub persistence schema v004 — agent runs + steps
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'agent_runs')
BEGIN
  CREATE TABLE agent_runs (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    project_id      NVARCHAR(128)  NULL,
    conversation_id UNIQUEIDENTIFIER NULL,
    goal            NVARCHAR(MAX)  NULL,
    status          NVARCHAR(32)   NOT NULL DEFAULT 'pending',
    current_step    INT            NOT NULL DEFAULT 0,
    plan_json       NVARCHAR(MAX)  NULL,
    metadata_json   NVARCHAR(MAX)  NULL,
    created_by      NVARCHAR(128)  NULL,
    error_json      NVARCHAR(MAX)  NULL,
    started_at      DATETIME2      NULL,
    finished_at     DATETIME2      NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_agent_runs_status ON agent_runs (status, updated_at DESC);
  CREATE INDEX IX_agent_runs_conversation ON agent_runs (conversation_id, updated_at DESC);
  CREATE INDEX IX_agent_runs_project ON agent_runs (project_id, updated_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'agent_run_steps')
BEGIN
  CREATE TABLE agent_run_steps (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    run_id          UNIQUEIDENTIFIER NOT NULL,
    step_index      INT            NOT NULL,
    step_type       NVARCHAR(16)   NOT NULL,
    tool_name       NVARCHAR(256)  NULL,
    status          NVARCHAR(16)   NOT NULL DEFAULT 'ok',
    input_json      NVARCHAR(MAX)  NULL,
    output_json     NVARCHAR(MAX)  NULL,
    duration_ms     INT            NULL,
    retry_count     INT            NOT NULL DEFAULT 0,
    usage_json      NVARCHAR(MAX)  NULL,
    metadata_json   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_agent_run_steps_run FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
    CONSTRAINT UQ_agent_run_steps_index UNIQUE (run_id, step_index)
  );
  CREATE INDEX IX_agent_run_steps_run ON agent_run_steps (run_id, step_index);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'agent_run_checkpoints')
BEGIN
  CREATE TABLE agent_run_checkpoints (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    run_id          UNIQUEIDENTIFIER NOT NULL,
    step_id         UNIQUEIDENTIFIER NULL,
    approval_id     NVARCHAR(64)   NULL,
    checkpoint_type NVARCHAR(32)   NOT NULL,
    payload_json    NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_agent_run_checkpoints_run FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_agent_run_checkpoints_run ON agent_run_checkpoints (run_id, created_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 4)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (4);
END;
