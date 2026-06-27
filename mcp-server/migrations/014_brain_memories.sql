-- Hub persistence schema v014 — brain memories (source of truth)
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'brain_memories')
BEGIN
  CREATE TABLE brain_memories (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    content         NVARCHAR(MAX)  NOT NULL,
    memory_type     NVARCHAR(32)   NOT NULL DEFAULT 'fact',
    tags_json       NVARCHAR(MAX)  NULL,
    project_id      NVARCHAR(128)  NULL,
    importance      FLOAT          NOT NULL DEFAULT 0.5,
    confidence      FLOAT          NOT NULL DEFAULT 1.0,
    source          NVARCHAR(64)   NOT NULL DEFAULT 'user',
    metadata_json   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    deleted_at      DATETIME2      NULL
  );
  CREATE INDEX IX_brain_memories_ns_updated ON brain_memories (namespace, updated_at DESC) WHERE deleted_at IS NULL;
  CREATE INDEX IX_brain_memories_project ON brain_memories (namespace, project_id) WHERE deleted_at IS NULL;
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 14)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (14);
END;
