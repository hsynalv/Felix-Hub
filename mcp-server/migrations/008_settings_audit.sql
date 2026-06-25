-- Settings change audit (values never stored)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'settings_audit')
BEGIN
  CREATE TABLE settings_audit (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    actor_id NVARCHAR(128) NULL,
    action NVARCHAR(64) NOT NULL,
    key_name NVARCHAR(256) NOT NULL,
    plugin_name NVARCHAR(128) NULL,
    created_at DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_settings_audit_created ON settings_audit (created_at DESC);
END;

INSERT INTO hub_schema_version (version, applied_at) VALUES (8, SYSUTCDATETIME());
