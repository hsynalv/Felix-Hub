# 08 — Prompt Importer

> **Status:** not_started  
> **Bağımlılık:** [SOURCE-ARCHIVE.md](./SOURCE-ARCHIVE.md), 10 Provenance

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

- [ ] `mcp-server/scripts/prompt-importer.js`
- [ ] Provider map config (`importer.providers.json`)
- [ ] Human review queue UI veya markdown report

---

## Başarı kriteri

- [ ] Kiro + Cursor örneklerinden ≥2 draft pattern, provenance etiketli
