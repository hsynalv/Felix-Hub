#!/usr/bin/env bash
# Start Felix Desktop (sidecar) under PM2 — terminal açık tutmaya gerek yok.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONFIG_DIR="${FELIX_DESKTOP_CONFIG:-$HOME/.config/felix-desktop}"
ENV_FILE="$CONFIG_DIR/env"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 yok. Kur: npm install -g pm2"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "[sidecar:pm2] node_modules yok — npm install…"
  npm install
fi

mkdir -p logs

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

BIND="${SIDECAR_BIND:-127.0.0.1}"
if [[ "$BIND" != "127.0.0.1" && "$BIND" != "localhost" && -z "${SIDECAR_AUTH_TOKEN:-}" ]]; then
  echo "Hata: SIDECAR_BIND=$BIND ama SIDECAR_AUTH_TOKEN boş."
  echo "Önce hub'da pair et, token'ı $ENV_FILE içine yaz."
  exit 1
fi

if curl -sf "http://127.0.0.1:${SIDECAR_PORT:-9477}/health" >/dev/null 2>&1; then
  if ! pm2 describe felix-sidecar >/dev/null 2>&1; then
    echo "[sidecar:pm2] Port ${SIDECAR_PORT:-9477} dolu — muhtemelen npm run sidecar:daemon çalışıyor."
    echo "          Önce onu durdur (Ctrl+C), sonra tekrar: npm run sidecar:pm2:start"
    exit 1
  fi
fi

pm2_start_or_recover() {
  if pm2 describe felix-sidecar >/dev/null 2>&1; then
    echo "[sidecar:pm2] Yeniden başlatılıyor…"
    pm2 restart felix-sidecar --update-env || {
      pm2 delete felix-sidecar 2>/dev/null || true
      pm2 start ecosystem.sidecar.config.cjs
    }
  else
    echo "[sidecar:pm2] Başlatılıyor…"
    pm2 start ecosystem.sidecar.config.cjs
  fi
}

pm2_start_or_recover

sleep 1
pm2 status felix-sidecar 2>/dev/null || pm2 status

echo ""
echo "Sidecar PM2 altında. Terminali kapatabilirsin."
echo "  Log:    npm run sidecar:pm2:logs"
echo "  Durum:  npm run sidecar:pm2:status"
echo "  Durdur: npm run sidecar:pm2:stop"
echo ""
echo "Mac yeniden açılınca otomatik başlasın:"
echo "  pm2 save && pm2 startup   (çıkan sudo komutunu bir kez çalıştır)"
