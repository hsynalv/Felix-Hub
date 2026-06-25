-- Sidecar paired devices registry
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'sidecar_devices')
BEGIN
  CREATE TABLE sidecar_devices (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(256) NOT NULL,
    base_url NVARCHAR(512) NOT NULL,
    capabilities_json NVARCHAR(MAX) NULL,
    auth_token NVARCHAR(512) NOT NULL,
    paired_at DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME(),
    last_seen_at DATETIMEOFFSET NULL
  );
  CREATE INDEX IX_sidecar_devices_last_seen ON sidecar_devices (last_seen_at DESC);
END;

INSERT INTO hub_schema_version (version, applied_at) VALUES (9, SYSUTCDATETIME());
