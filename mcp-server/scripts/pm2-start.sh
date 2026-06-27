#!/usr/bin/env bash
# Build UI once, then start PM2 (no file watchers — updates only via pm2:reload).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Install: npm install -g pm2"
  exit 1
fi

mkdir -p logs

if [[ ! -d node_modules ]] || [[ "${PM2_INSTALL:-0}" == "1" ]]; then
  bash scripts/install-deps.sh
else
  echo "[pm2] node_modules present — skip install (set PM2_INSTALL=1 to force)"
fi

echo "[pm2] Building frontend…"
npm run ui:build

bash scripts/pm2-ensure.sh

echo ""
echo "Persist across reboot: pm2 save && pm2 startup  (run startup command as root once)"
echo "After git pull + changes: npm run pm2:reload"
