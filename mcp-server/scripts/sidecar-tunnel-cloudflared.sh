#!/usr/bin/env bash
# Uzak Felix Hub'ın yerel sidecar'a erişmesi için geçici HTTPS tunnel.
# Önkoşul: npm run sidecar:daemon çalışıyor olmalı (127.0.0.1:9477).
#
# Kullanım: npm run sidecar:tunnel
# Çıktıdaki https://....trycloudflare.com URL'sini pair formunda baseUrl olarak girin.

set -euo pipefail

PORT="${SIDECAR_PORT:-9477}"
LOCAL="http://127.0.0.1:${PORT}"

if ! curl -sf "${LOCAL}/health" >/dev/null 2>&1; then
  echo "Sidecar çalışmıyor: ${LOCAL}/health"
  echo "Önce başka terminalde: npm run sidecar:daemon"
  exit 1
fi

if command -v cloudflared >/dev/null 2>&1; then
  echo "==> cloudflared quick tunnel → ${LOCAL}"
  echo "    Pair'de baseUrl olarak aşağıdaki https:// URL'yi kullanın (Ctrl+C ile kapatın)."
  echo ""
  exec cloudflared tunnel --url "${LOCAL}"
fi

if command -v ngrok >/dev/null 2>&1; then
  echo "==> ngrok http ${PORT}"
  echo "    Pair'de baseUrl olarak ngrok https URL'sini kullanın."
  exec ngrok http "${PORT}"
fi

cat <<'EOF'
Tunnel aracı bulunamadı. Birini kurun:

  macOS (cloudflared — önerilen):
    brew install cloudflared
    npm run sidecar:tunnel

  veya ngrok:
    brew install ngrok
    ngrok http 9477

Sonra Settings → Felix Desktop → baseUrl = tunnel https URL (127.0.0.1 değil).
EOF
exit 1
