-- Hub persistence schema v011 — intent training samples, corpus, model versions
-- Idempotent: safe to re-run

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'intent_training_samples')
BEGIN
  CREATE TABLE intent_training_samples (
    id                  UNIQUEIDENTIFIER PRIMARY KEY,
    user_message        NVARCHAR(2000) NOT NULL,
    predicted_intent    NVARCHAR(32)   NOT NULL,
    predicted_confidence FLOAT         NOT NULL,
    prediction_source   NVARCHAR(16)   NOT NULL,
    effective_intent    NVARCHAR(32)   NULL,
    tools_used_json     NVARCHAR(MAX)  NULL,
    guard_blocks_json   NVARCHAR(MAX)  NULL,
    project_id          NVARCHAR(128)  NULL,
    conversation_id     UNIQUEIDENTIFIER NULL,
    run_id              UNIQUEIDENTIFIER NULL,
    chat_profile        NVARCHAR(32)   NULL,
    label_status        NVARCHAR(16)   NOT NULL DEFAULT 'pending',
    labeled_intent      NVARCHAR(32)   NULL,
    llm_suggested_intent NVARCHAR(32)  NULL,
    user_confirmed_intent NVARCHAR(32) NULL,
    label_confidence    FLOAT          NULL,
    label_reason        NVARCHAR(512)  NULL,
    disagreement_at     DATETIME2      NULL,
    confirmed_at        DATETIME2      NULL,
    confirmed_by        NVARCHAR(128)  NULL,
    model_version       INT            NULL,
    created_at          DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_intent_samples_status ON intent_training_samples (label_status, created_at DESC);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'intent_corpus_entries')
BEGIN
  CREATE TABLE intent_corpus_entries (
    id          UNIQUEIDENTIFIER PRIMARY KEY,
    intent      NVARCHAR(32)   NOT NULL,
    utterance   NVARCHAR(2000) NOT NULL,
    locale      NVARCHAR(8)    NOT NULL DEFAULT 'tr',
    source      NVARCHAR(16)   NOT NULL,
    sample_id   UNIQUEIDENTIFIER NULL,
    active      BIT            NOT NULL DEFAULT 1,
    created_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_intent_corpus_intent ON intent_corpus_entries (intent, active);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'intent_model_versions')
BEGIN
  CREATE TABLE intent_model_versions (
    version           INT PRIMARY KEY,
    corpus_count      INT          NOT NULL,
    eval_accuracy     FLOAT        NULL,
    eval_report_json  NVARCHAR(MAX) NULL,
    promoted_at       DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    promoted_by       NVARCHAR(128) NULL
  );
END;

IF NOT EXISTS (SELECT 1 FROM hub_schema_version WHERE version = 11)
BEGIN
  INSERT INTO hub_schema_version (version) VALUES (11);
END;
