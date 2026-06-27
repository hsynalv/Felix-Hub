# PM2 — sürekli yayın (Felix Hub)

`npm run hub:live` geliştirme içindir (`node --watch` + `ui:watch`). Sunucuda PM2 ile **stabil** mod kullanın: dosya izleme yok, siz `pm2:reload` çalıştırana kadar kod değişmez.

## Kurulum (bir kez)

```bash
cd mcp-server
pnpm install          # kök — pnpm-lock.yaml
pnpm install --dir frontend
cp .env.example .env  # production değerleri
npm install -g pm2
```

Proje kökü **pnpm** kullanır. Kökte `npm install` çalıştırmayın — pnpm `node_modules` ile çakışır. PM2 scriptleri `scripts/install-deps.sh` ile pnpm kullanır.

`.env` içinde en azından:

```env
NODE_ENV=production
PORT=8787
CORS_ALLOWED_ORIGINS=https://asistan.huseyinalav.com
```

`NODE_ENV=production` iken `CORS_ALLOWED_ORIGINS` zorunludur (startup sanity). PM2 artık `.env` değerlerini ezmiyor.

## Başlat

```bash
npm run pm2:start
```

- Frontend bir kez build edilir
- API `node src/index.js` olarak PM2 altında çalışır
- Crash olursa PM2 otomatik yeniden başlatır

## Güncelleme (siz çekince)

```bash
git pull
cd mcp-server
npm run pm2:reload
```

`pm2:reload` → `pnpm install` + `ui:build` + `pm2 restart`

## Günlük komutlar

| Komut | Açıklama |
|--------|----------|
| `npm run pm2:status` | Durum |
| `npm run pm2:logs` | Log tail |
| `npm run pm2:stop` | Durdur |
| `npm run pm2:delete` | PM2 listesinden kaldır |

## Sunucu reboot sonrası ayakta kalsın

```bash
pm2 save
pm2 startup
# çıkan sudo komutunu bir kez çalıştırın
pm2 save
```

## `hub:live` vs PM2

| | `hub:live` | PM2 (`pm2:start`) |
|--|------------|-------------------|
| Amaç | Lokal geliştirme | Production / staging |
| API | `node --watch` | `node` (sabit) |
| UI | `build:watch` | Build sadece start/reload |
| Otomatik kod güncelleme | Dosya değişince | Yok (manuel `pm2:reload`) |

## Loglar

`mcp-server/logs/pm2-out.log` ve `pm2-error.log`
