# MCP Hub Brain Sync (Obsidian)

Opsiyonel **Obsidian community plugin** — vault notlarını hub brain API’si ile push/pull eder.

Ana uygulama (`mcp-server`) bunu çalıştırmaz; Obsidian’a ayrı kurulur.

## Kurulum

```bash
cd mcp-server/integrations/obsidian-plugin
npm install
npm run build
```

Derlenen `main.js`, `manifest.json` ve `styles.css` dosyalarını Obsidian vault’unda:

`YourVault/.obsidian/plugins/mcp-hub-brain-sync/`

Hub ayarları: plugin settings → `hubUrl` (ör. `http://localhost:8787`) ve `HUB_WRITE_KEY`.

İlgili hub env: `OBSIDIAN_VAULT_PATH`, `OBSIDIAN_EXPORT_ENABLED` (brain plugin).
