#!/usr/bin/env bash
# Rebuild UI + restart API — run this after you deploy new code.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Install: npm install -g pm2"
  exit 1
fi

if ! pm2 describe felix-hub >/dev/null 2>&1; then
  echo "felix-hub is not running. Use: npm run pm2:start"
  exit 1
fi

bash scripts/install-deps.sh

echo "[pm2] Building frontend…"
npm run ui:build

echo "[pm2] Restarting felix-hub…"
if ! pm2 restart felix-hub --update-env 2>/dev/null; then
  echo "[pm2] Restart failed — delete and start fresh"
  pm2 delete felix-hub 2>/dev/null || true
  pm2 start ecosystem.config.cjs --update-env
fi

pm2 status felix-hub
