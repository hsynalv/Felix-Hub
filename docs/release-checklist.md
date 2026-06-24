# Release Checklist

> Release öncesi `main` veya `develop` üzerinden tag atmadan önce tamamlanmalı.

## Otomatik (CI)

- [ ] `ci.yml` — lint, `validate:plugins` (STRICT), `test:run`, coverage
- [ ] `integration.yml` — `test:integration:stable`
- [ ] `ui:build` — frontend derlemesi başarılı

## Yerel doğrulama

```bash
cd mcp-server
pnpm install
pnpm run validate:plugins    # STRICT_PLUGIN_META=true önerilir
pnpm run test:run
pnpm run test:integration:stable
pnpm run ui:build
```

## Manuel paket

Canlı API / OS bağımlı senaryolar için: [manual-test-pack.md](./manual-test-pack.md)

Özellikle release'te dokunulan plugin'ler için ilgili bölümler işaretlenmeli.

## Production `.env`

- [ ] `NODE_ENV=production`
- [ ] `HUB_READ_KEY`, `HUB_WRITE_KEY`, `HUB_ADMIN_KEY` — min 16 karakter, placeholder yok
- [ ] `HUB_BIND_HOST=127.0.0.1` (veya güvenilir reverse proxy arkası)
- [ ] `CORS_ALLOWED_ORIGINS` dar whitelist
- [ ] `ENABLE_MARKETPLACE=false` (gerekmedikçe)
- [ ] `STRICT_PLUGIN_META=true`, `STRICT_TOOL_SCHEMA=true` (önerilir)

## Tag & release

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

`release.yml` otomatik olarak `test:run`, `test:integration:stable` ve `ui:build` çalıştırır.

## Hâlâ nightly / manuel test suite

`pnpm run test:integration` — notion, rag, e2e, smoke ve diğer env-heavy dosyalar.  
Nightly `integration-full` job veya release öncesi manuel.
