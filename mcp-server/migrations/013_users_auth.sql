-- Hub persistence schema v013 — users, sessions, tenant namespaces
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hub_users')
BEGIN
  CREATE TABLE hub_users (
    id              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    email           NVARCHAR(256)    NOT NULL,
    password_hash   NVARCHAR(512)    NOT NULL,
    display_name    NVARCHAR(128)    NOT NULL,
    role            NVARCHAR(32)     NOT NULL DEFAULT 'user',
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_hub_users_email UNIQUE (email)
  );
  CREATE INDEX IX_hub_users_email ON hub_users (email);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hub_sessions')
BEGIN
  CREATE TABLE hub_sessions (
    id                   UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id              UNIQUEIDENTIFIER NOT NULL,
    session_token_hash   NVARCHAR(128)    NOT NULL,
    refresh_token_hash   NVARCHAR(128)    NOT NULL,
    expires_at           DATETIME2        NOT NULL,
    refresh_expires_at   DATETIME2        NOT NULL,
    ip                   NVARCHAR(64)     NULL,
    user_agent           NVARCHAR(512)    NULL,
    revoked_at           DATETIME2        NULL,
    created_at           DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_hub_sessions_user FOREIGN KEY (user_id) REFERENCES hub_users(id)
  );
  CREATE INDEX IX_hub_sessions_token ON hub_sessions (session_token_hash);
  CREATE INDEX IX_hub_sessions_refresh ON hub_sessions (refresh_token_hash);
  CREATE INDEX IX_hub_sessions_user ON hub_sessions (user_id, revoked_at);
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 13)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (13);
END;
