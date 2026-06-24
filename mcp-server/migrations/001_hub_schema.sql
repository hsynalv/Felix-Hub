-- Hub persistence schema v001
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hub_schema_version')
BEGIN
  CREATE TABLE hub_schema_version (
    version     INT NOT NULL PRIMARY KEY,
    applied_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'settings_encrypted')
BEGIN
  CREATE TABLE settings_encrypted (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    key_name        NVARCHAR(128)  NOT NULL,
    ciphertext      VARBINARY(MAX) NOT NULL,
    iv              VARBINARY(16)  NOT NULL,
    auth_tag        VARBINARY(16)  NOT NULL,
    key_version     INT            NOT NULL DEFAULT 1,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    updated_by      NVARCHAR(128)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_settings_key_ns UNIQUE (key_name, namespace)
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'connection_profiles')
BEGIN
  CREATE TABLE connection_profiles (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    profile_name    NVARCHAR(128)  NOT NULL,
    profile_type    NVARCHAR(32)   NOT NULL,
    config_json     NVARCHAR(MAX)  NOT NULL,
    secret_ref_id   UNIQUEIDENTIFIER NULL,
    is_default      BIT            NOT NULL DEFAULT 0,
    is_active       BIT            NOT NULL DEFAULT 1,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_conn_profile_name_ns UNIQUE (profile_name, namespace)
  );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_archive')
BEGIN
  CREATE TABLE audit_archive (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_id        UNIQUEIDENTIFIER NOT NULL,
    event_type      NVARCHAR(32)   NOT NULL,
    plugin_name     NVARCHAR(64)   NULL,
    operation       NVARCHAR(256)  NULL,
    actor           NVARCHAR(128)  NULL,
    scope           NVARCHAR(32)   NULL,
    success         BIT            NOT NULL,
    duration_ms     INT            NULL,
    payload_json    NVARCHAR(MAX)  NULL,
    correlation_id  NVARCHAR(64)   NULL,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    occurred_at     DATETIME2      NOT NULL,
    archived_at     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_audit_occurred ON audit_archive (occurred_at DESC);
  CREATE INDEX IX_audit_plugin ON audit_archive (plugin_name, occurred_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'memory_sync_state')
BEGIN
  CREATE TABLE memory_sync_state (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    memory_id       NVARCHAR(64)   NOT NULL,
    namespace       NVARCHAR(64)   NOT NULL DEFAULT 'default',
    sync_target     NVARCHAR(32)   NOT NULL,
    target_path     NVARCHAR(512)  NULL,
    content_hash    NVARCHAR(64)   NULL,
    last_synced_at  DATETIME2      NULL,
    sync_status     NVARCHAR(16)   NOT NULL DEFAULT 'pending',
    error_message   NVARCHAR(MAX)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_mem_sync UNIQUE (memory_id, namespace, sync_target)
  );
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 1)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (1);
END;
