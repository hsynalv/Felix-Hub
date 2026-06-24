-- Hub persistence schema v002 — chat conversations
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_conversations')
BEGIN
  CREATE TABLE chat_conversations (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    title           NVARCHAR(256)  NULL,
    project_id      NVARCHAR(128)  NULL,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    model           NVARCHAR(128)  NULL,
    metadata_json   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    archived_at     DATETIME2      NULL
  );
  CREATE INDEX IX_chat_conversations_ns_updated ON chat_conversations (namespace, updated_at DESC);
  CREATE INDEX IX_chat_conversations_project ON chat_conversations (project_id, updated_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_messages')
BEGIN
  CREATE TABLE chat_messages (
    id              UNIQUEIDENTIFIER PRIMARY KEY,
    conversation_id UNIQUEIDENTIFIER NOT NULL,
    seq             INT            NOT NULL,
    role            NVARCHAR(16)   NOT NULL,
    content         NVARCHAR(MAX)  NOT NULL,
    metadata_json   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id),
    CONSTRAINT UQ_chat_messages_seq UNIQUE (conversation_id, seq)
  );
  CREATE INDEX IX_chat_messages_conversation ON chat_messages (conversation_id, seq);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 2)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (2);
END;
