-- Hub persistence schema v012 — intent sample decision envelope
-- Idempotent: safe to re-run

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('intent_training_samples') AND name = 'decision_envelope_json'
)
BEGIN
  ALTER TABLE intent_training_samples ADD decision_envelope_json NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 12)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (12);
END;
