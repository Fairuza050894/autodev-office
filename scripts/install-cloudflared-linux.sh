#!/usr/bin/env bash
# install-cloudflared-linux.sh — Install cloudflared + watchdog as systemd services on Linux
# Run as root or with sudo: sudo ./scripts/install-cloudflared-linux.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run with sudo: sudo $0"
  exit 1
fi

echo "=== Install Cloudflare Tunnel + Watchdog on Linux (systemd) ==="
echo "Target user: $TARGET_USER"
echo "Target home: $TARGET_HOME"
echo "Repo root:   $REPO_ROOT"

# 1. Install cloudflared
if ! command -v cloudflared &> /dev/null; then
  echo "Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/cloudflared.gpg | tee /usr/share/keyrings/cloudflared.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflared.gpg] https://pkg.cloudflare.com/cloudflared any main" | tee /etc/apt/sources.list.d/cloudflared.list
  apt-get update && apt-get install -y cloudflared
else
  echo "cloudflared found: $(cloudflared --version)"
fi

# 2. Install service files
cp "$REPO_ROOT/infra/cloudflared@.service" /etc/systemd/system/
cp "$REPO_ROOT/infra/watchdog-ngrok@.service" /etc/systemd/system/
cp "$REPO_ROOT/infra/watchdog-ngrok@.timer" /etc/systemd/system/

# 3. Reload systemd
systemctl daemon-reload

# 4. Enable & start for target user
systemctl enable --now "cloudflared@$TARGET_USER.service"
systemctl enable --now "watchdog-ngrok@$TARGET_USER.timer"

# 5. Vercel token reminder
echo ""
echo "=== Vercel Token Required for Watchdog ==="
echo "Create token at: https://vercel.com/account/tokens"
echo "Then run as $TARGET_USER:"
echo "  echo 'YOUR_VERCEL_TOKEN' > ~/.vercel_token"
echo "  chmod 600 ~/.vercel_token"
echo ""

# 6. Status
echo "=== Status ==="
systemctl status "cloudflared@$TARGET_USER.service" --no-pager || true
systemctl status "watchdog-ngrok@$TARGET_USER.timer" --no-pager || true
echo ""
echo "Logs:"
echo "  journalctl -u cloudflared@$TARGET_USER -f"
echo "  journalctl -u watchdog-ngrok@$TARGET_USER -f"