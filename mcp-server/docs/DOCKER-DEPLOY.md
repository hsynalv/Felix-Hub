# Docker — sunucuda yayın (Felix Hub)

Bu makine **geliştirme**, sunucu **Docker ile production**. PM2 yerine container kullanın.

## Roller

| Ortam | Nasıl çalışır |
|--------|----------------|
| Lokal (Mac) | `pnpm install` + `npm run hub:live` — hot reload |
| Sunucu | `docker compose up -d --build` — sabit image, siz güncellersiniz |

## Sunucu — ilk kurulum

```bash
# Repo
git clone https://github.com/hsynalv/Felix-Hub.git mcp-hub
cd mcp-hub/mcp-server

# Ortam
cp .env.example .env
nano .env   # anahtarlar, MSSQL, CORS, seed kullanıcı

# Build + başlat
docker compose up -d --build

# Kontrol
docker compose ps
curl -s http://127.0.0.1:8787/health
docker compose logs -f --tail=100
```

### `.env` zorunluları (production)

- `HUB_READ_KEY`, `HUB_WRITE_KEY`, `HUB_ADMIN_KEY`
- `CORS_ALLOWED_ORIGINS` — örn. `https://asistan.huseyinalav.com`
- `HUB_MSSQL_URL`, `HUB_SETTINGS_MASTER_KEY` (persistence açıksa)
- `HUB_SEED_*` — ilk giriş için (sonra `.env`'den kaldırabilirsiniz)

`docker-compose.yml` container içinde `HUB_BIND_HOST=0.0.0.0` ve `NODE_ENV=production` set eder.

## Reverse proxy (nginx örneği)

Hub yalnızca `127.0.0.1:8787`'de dinler; TLS nginx'te:

```nginx
server {
    listen 443 ssl http2;
    server_name asistan.huseyinalav.com;

    # ssl_certificate ...

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

`CORS_ALLOWED_ORIGINS` değeri proxy'deki `https://` origin ile birebir eşleşmeli.

## Güncelleme

```bash
cd mcp-hub/mcp-server
git pull
docker compose up -d --build
```

Eski container durur, yeni image build edilir, servis yeniden başlar.

## Komutlar

| Komut | Açıklama |
|--------|----------|
| `docker compose up -d --build` | Build + arka planda çalıştır |
| `docker compose logs -f` | Log |
| `docker compose ps` | Durum |
| `docker compose down` | Durdur (volume kalır) |
| `docker compose down -v` | Volume dahil sil |

npm scriptleri: `npm run docker:build`, `docker:up`, `docker:logs`, `docker:down`

## Volume

`felix-cache` — plugin cache / audit dosyaları için kalıcı disk.

## Lokal Docker testi (isteğe bağlı)

Production `.env` kopyalayıp:

```bash
docker compose up --build
```

Geliştirmede günlük iş için Docker şart değil; `hub:live` yeterli.

## PM2

Sunucuda PM2 kullanmayın — `felix-hub` PM2 süreci varsa:

```bash
pm2 delete felix-hub
```

Bundan sonra yalnızca Docker.
