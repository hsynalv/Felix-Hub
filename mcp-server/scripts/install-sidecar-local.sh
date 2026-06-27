#!/usr/bin/env bash
# Felix Desktop (sidecar) — kurulum bu PC'de, hub uzak sunucuda olabilir.
#
# Kullanım (mcp-server dizininden):
#   ./scripts/install-sidecar-local.sh          # config + bağımlılıklar
#   ./scripts/install-sidecar-local.sh --launchd # macOS arka plan servisi
#   ./scripts/install-sidecar-local.sh --run    # ön planda daemon
#
# Uzak production hub: docs/SIDECAR-REMOTE-HUB.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="${FELIX_DESKTOP_CONFIG:-$HOME/.config/felix-desktop}"
ENV_FILE="$CONFIG_DIR/env"
HUB_URL="${FELIX_HUB_URL:-${HUB_URL:-https://asistan.huseyinalav.com}}"

MODE="setup"
for arg in "$@"; do
  case "$arg" in
    --launchd) MODE="launchd" ;;
    --run) MODE="run" ;;
    --help|-h)
      echo "Usage: $0 [--launchd | --run]"
      exit 0
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ gerekli: https://nodejs.org"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node 18+ gerekli (mevcut: $(node -v))"
  exit 1
fi

echo "==> Felix Desktop kurulumu"
echo "    Hub (referans): $HUB_URL"
echo "    Config:         $ENV_FILE"
echo ""

cd "$MCP_SERVER_DIR"
if [[ ! -d node_modules ]]; then
  echo "==> npm install (ilk kurulum)..."
  npm install
fi

mkdir -p "$CONFIG_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
# Felix Desktop — yerel sidecar (~/.config/felix-desktop/env)
# Pair sonrası authToken'ı SIDECAR_AUTH_TOKEN altına yapıştırın.

SIDECAR_PORT=9477
SIDECAR_AUTH_TOKEN=

# Uzak hub — sabit IP + port forward (önerilen, tunnel gerekmez):
# SIDECAR_BIND=0.0.0.0
# SIDECAR_PUBLIC_URL=http://SENIN_SABIT_IP:9477
# Modemde 9477 → bu Mac'in yerel IP'sine yönlendir; macOS güvenlik duvarında izin ver.

# Alternatif: tunnel (sabit IP yoksa)
# npm run sidecar:tunnel

# Uzak hub (bilgi amaçlı)
FELIX_HUB_URL=$HUB_URL

# İsteğe bağlı: dosya whitelist JSON yolu
# WHITELIST_CONFIG_PATH=$CONFIG_DIR/whitelist.json
EOF
  echo "Oluşturuldu: $ENV_FILE"
else
  echo "Mevcut config: $ENV_FILE"
fi

echo ""
echo "Sonraki adımlar:"
echo "  Sabit IP varsa (tunnel gerekmez):"
echo "    1. ~/.config/felix-desktop/env → SIDECAR_BIND=0.0.0.0"
echo "    2. Modem port forward: 9477 → bu Mac"
echo "    3. npm run sidecar:daemon"
echo "    4. Pair baseUrl: http://SABIT_IP:9477"
echo ""
echo "  Sabit IP yoksa:"
echo "    1. npm run sidecar:daemon"
echo "    2. npm run sidecar:tunnel"
echo "    3. Pair baseUrl: tunnel https URL"
echo ""
echo "  Ortak:"
echo "    $HUB_URL → Ayarlar → Felix Desktop → kod → eşleştir"
echo "    authToken → $ENV_FILE içinde SIDECAR_AUTH_TOKEN=..."
echo ""
echo "Detay: docs/SIDECAR-REMOTE-HUB.md"
echo ""

if [[ "$MODE" == "run" ]]; then
  exec npm run sidecar:daemon
fi

if [[ "$MODE" == "launchd" ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "--launchd yalnızca macOS'ta. Linux: systemd unit veya npm run sidecar:daemon"
    exit 1
  fi
  exec "$SCRIPT_DIR/install-felix-desktop.sh"
fi

# shellcheck source=/dev/null
source "$ENV_FILE" 2>/dev/null || true
if [[ -z "${SIDECAR_AUTH_TOKEN:-}" ]]; then
  echo "SIDECAR_AUTH_TOKEN henüz boş — eşleştirmeden sonra $0 --launchd veya npm run sidecar:daemon"
else
  echo "Token ayarlı. Başlatmak için: npm run sidecar:daemon"
  echo "macOS arka plan: $0 --launchd"
fi
