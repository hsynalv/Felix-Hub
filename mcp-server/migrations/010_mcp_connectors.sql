-- External MCP connector definitions (stdio child processes)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mcp_connectors')
BEGIN
  CREATE TABLE mcp_connectors (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    slug NVARCHAR(64) NOT NULL UNIQUE,
    display_name NVARCHAR(128) NOT NULL,
    command NVARCHAR(256) NOT NULL,
    args_json NVARCHAR(MAX) NOT NULL,
    env_keys_json NVARCHAR(MAX) NULL,
    enabled BIT NOT NULL DEFAULT 0,
    last_health NVARCHAR(16) NULL,
    last_verified_at DATETIMEOFFSET NULL,
    tool_count INT NOT NULL DEFAULT 0,
    last_error NVARCHAR(512) NULL,
    created_by NVARCHAR(128) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_mcp_connectors_enabled ON mcp_connectors (enabled);
END;

INSERT INTO hub_schema_version (version, applied_at) VALUES (10, SYSUTCDATETIME());
