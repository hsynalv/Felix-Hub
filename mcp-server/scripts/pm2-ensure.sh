#!/usr/bin/env bash
# Start or recover felix-hub in PM2 (delete + start if restart fails / stale).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pm2_start_or_recover() {
  if pm2 describe felix-hub >/dev/null 2>&1; then
    echo "[pm2] Restarting felix-hub…"
    if ! pm2 restart felix-hub --update-env 2>/dev/null; then
      echo "[pm2] Restart failed (stale process) — delete and start fresh"
      pm2 delete felix-hub 2>/dev/null || true
      pm2 start ecosystem.config.cjs --update-env
    fi
  else
    echo "[pm2] Starting felix-hub"
    pm2 start ecosystem.config.cjs --update-env
  fi
}

pm2_start_or_recover

pm2 status felix-hub 2>/dev/null || pm2 status

# Warn if process is not online after a moment
sleep 2
status="$(pm2 jlist 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try {
      const apps=JSON.parse(d);
      const a=apps.find(x=>x.name==='felix-hub');
      console.log(a?.pm2_env?.status||'missing');
    } catch { console.log('unknown'); }
  });
" 2>/dev/null || echo "unknown")"

if [[ "$status" != "online" ]]; then
  echo ""
  echo "[pm2] WARNING: felix-hub status is '$status' (not online)."
  echo "        Check logs: npm run pm2:logs"
  echo "        Common fix: set CORS_ALLOWED_ORIGINS in .env when NODE_ENV=production"
  exit 1
fi
