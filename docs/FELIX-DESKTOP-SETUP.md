# Felix Desktop — kurulum rehberi

Felix Desktop (sidecar), **senin bilgisayarında** çalışan yerel ajandır: dosya okuma/yazma, terminal, masaüstü bildirimi, ekran görüntüsü. Felix Hub sunucusu bu işleri doğrudan yapmaz; eşleşmiş bir sidecar’a HTTP ile istek atar.

## Mimari (önemli)

```
[ Tarayıcı / Telegram ]  →  Felix Hub (sunucu)
                                ↓ HTTP fetch
                           baseUrl (eşleştirmede kayıtlı)
                                ↓
                           Felix Desktop (senin Mac/PC, :9477)
```

Hub, `sidecar_devices` tablosundaki **baseUrl**’e bağlanır. Bu yüzden:

| Senaryo | Çalışır mı? |
|---------|-------------|
| Hub + Desktop **aynı makine** (VPS’te ikisi birden) | Evet — `baseUrl: http://127.0.0.1:9477` |
| Hub **uzak sunucu**, Desktop **senin Mac’in** | **Şu an kısıtlı** — sunucu kendi `127.0.0.1`’ine gider, Mac’ine değil |
| Geliştirme (`NODE_ENV=development`) | Sidecar **zorunlu değil** — `LOCAL_FS_ON_SERVER=true` (varsayılan) |

Uzak hub + yerel masaüstü için bugünkü çözümler:

1. **Tunnel** — ngrok / Cloudflare Tunnel ile Mac’teki `9477`’yi geçici public URL’e aç; pair’de o URL’yi ver (ileride resmi outbound bridge gelecek).
2. **Hub’ı local çalıştır** — sadece UI/production API uzakta kalır (mevcut dev akışı).
3. **V4 (plan)** — sidecar’ın hub’a outbound WebSocket/mTLS ile bağlanması (docs/v3-path/09).

---

## Hızlı kurulum (geliştirme)

Repo’yu klonladıysan:

```bash
cd mcp-server
npm install
npm run sidecar:daemon
```

Sağlık: `curl http://127.0.0.1:9477/health`

Geliştirmede hub genelde sidecar **istemez**; dosyalar sunucu prosesinde çalışır.

---

## Production (hub sunucuda)

### 1. Sunucu env

```env
NODE_ENV=production
LOCAL_FS_ON_SERVER=false
```

### 2. Desktop’u çalıştır (eşleşecek makinede)

```bash
cd mcp-server
npm run sidecar:daemon
# veya global link:
npm link
felix-desktop
```

### 3. Eşleştir (pairing)

**Ayarlar → Felix Desktop** (UI) veya API:

```bash
# Admin — kod üret
curl -X POST https://asistan.huseyinalav.com/sidecar/pairing/code \
  -H "Authorization: Bearer $HUB_ADMIN_KEY"

# Write — cihaz kaydet
curl -X POST https://asistan.huseyinalav.com/sidecar/pair \
  -H "Authorization: Bearer $HUB_WRITE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456","deviceName":"macbook-pro","baseUrl":"http://127.0.0.1:9477"}'
```

Yanıttaki `authToken`’ı desktop’ta:

```bash
export SIDECAR_AUTH_TOKEN=<authToken>
felix-desktop
```

### 4. macOS — arka planda otomatik başlat

Token’ı `~/.config/felix-desktop/env` dosyasına yazdıktan sonra:

```bash
chmod +x mcp-server/scripts/install-felix-desktop.sh
./mcp-server/scripts/install-felix-desktop.sh
```

Bu script `launchd` servisi oluşturur; logout sonrası da Felix Desktop ayakta kalır.

---

## “Yüklenebilir program” yol haritası

| Aşama | Ne | Durum |
|-------|-----|--------|
| **Şimdi** | `felix-desktop` CLI (`npm link` / repo içi) | Var |
| **Şimdi** | macOS `install-felix-desktop.sh` (launchd) | Var |
| **Yakın** | `npm publish` → `npm i -g felix-desktop` (sadece daemon paketi) | Plan |
| **Yakın** | Homebrew: `brew install felix-desktop` | Plan |
| **Orta** | Menü çubuğu tray uygulaması (pairing sihirbazı, token saklama) | Plan |
| **V4** | Outbound bridge — uzak hub + yerel PC, tunnelsız | Plan |

Tray uygulaması veya `.dmg` installer istenirse: Electron veya Tauri ile `9477` daemon’u yöneten ince bir kabuk yeterli; çekirdek zaten `bin/sidecar-daemon.js`.

---

## Güvenlik özeti

- Dinleme: yalnızca `127.0.0.1:9477`
- Pairing sonrası `SIDECAR_AUTH_TOKEN` zorunlu (production)
- Dosya yolları whitelist; terminal allowlist
- Token’ı asla git’e commit etme — `~/.config/felix-desktop/env`

---

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Hub “sidecar required” | `LOCAL_FS_ON_SERVER=false`, en az 1 paired device |
| `sidecar_unreachable` | Daemon çalışıyor mu? Token doğru mu? |
| Uzak hub Mac’e erişemiyor | Aynı makine veya tunnel; V4 bridge’i bekle |
| `deviceCount: 0` | Pair adımını tamamla |

Detaylı API: [sidecar.md](./sidecar.md)
