#!/usr/bin/env bash
# Install deps using the lockfile's package manager (pnpm preferred for this repo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

install_root() {
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
    echo "[deps] pnpm install (root)"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    return
  fi
  if [[ -f package-lock.json ]]; then
    echo "[deps] npm ci (root)"
    npm ci 2>/dev/null || npm install
    return
  fi
  echo "[deps] npm install (root)"
  npm install
}

install_frontend() {
  if [[ ! -f frontend/package.json ]]; then
    return
  fi
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
    echo "[deps] pnpm install (frontend)"
    pnpm install --dir frontend --frozen-lockfile 2>/dev/null || pnpm install --dir frontend
    return
  fi
  if [[ -f frontend/package-lock.json ]]; then
    echo "[deps] npm ci (frontend)"
    npm ci --prefix frontend 2>/dev/null || npm install --prefix frontend
    return
  fi
  echo "[deps] npm install (frontend)"
  npm install --prefix frontend
}

install_root
install_frontend
