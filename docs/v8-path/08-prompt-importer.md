# 08 — Prompt Importer

> **Status:** done (MVP)  
> **Bağımlılık:** [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md), 10 Provenance  
> **Backlog:** [REMAINING-WORK.md](./REMAINING-WORK.md)

---

## Amaç

`system-prompts-and-models-of-ai-tools/` klasörünü tarayıp **draft pattern** üretmek — birebir kopya değil.

---

## Pipeline

```text
scan(dir)
  → detect provider (path heuristic)
  → segment heuristics (## headers, XML tags, ALL CAPS sections)
  → map to STANDARD_SECTION_KEYS
  → emit derived pattern (paraphrased bullet spec)
  → provenance.json entry
  → optional prompt_create draft (disabled by default)
```

---

## CLI (hedef)

```bash
npm run prompt:import -- --source ../system-prompts-and-models-of-ai-tools --dry-run
npm run prompt:import -- --provider Kiro --out cache/prompt-intelligence/drafts/
```

---

## Deliverables

- [x] `mcp-server/scripts/prompt-importer.js` + `npm run prompt:import`
- [x] Provider map (`importer.providers.json` / path heuristic)
- [x] Settings approval queue (`PromptImportSettingsPanel`, `POST /v8/import/*`)
- [x] Test izolasyonu: `CATALOG_CACHE_DIR` temp (`tests/helpers/temp-cache-env.js`)

---

## Başarı kriteri

- [x] Dry-run / scan → draft JSON + provenance
- [x] Approve → `prompts.json` registry (low-risk veya force)

- [x] Arşivden ≥2 draft pattern, provenance etiketli
