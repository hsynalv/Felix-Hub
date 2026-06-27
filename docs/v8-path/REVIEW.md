# V8 Prompt Review Checklist

Harici prompt arşivinden veya importer çıktısından **production**'a alınmadan önce:

## Zorunlu

- [ ] `provenance.json` / `provenance` alanı dolu (`sourceProvider`, `derivedAt`, `risk`)
- [ ] Identity yalnızca Felix Hub / Felix (`branding.js`) — başka ürün kimliği yok
- [ ] Vendor trademark yok (Cursor, Claude, ChatGPT, …) system prompt metninde
- [ ] "Ignore policy", "bypass approval", "pretend you are …" gibi ifadeler yok
- [ ] `risk: high` → varsayılan **disabled**, insan onayı sonrası enable

## Önerilen

- [ ] En az bir golden senaryoda eval notu veya `eval:prompt` skoru
- [ ] Section'lar `STANDARD_SECTION_KEYS` ile uyumlu veya custom key gerekçeli
- [ ] `prompt_create` / import audit log'da görünür

## Red flags (otomatik red)

- Verbatim GPL arşiv metni
- Shell/filesystem bypass dili
- API key / credential isteme talimatı

Şema: `mcp-server/src/plugins/prompt-registry/provenance.schema.json`
