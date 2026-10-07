#!/usr/bin/env bash
# install-cloudflared-macos.sh — Install cloudflared + watchdog as launchd agents on macOS
# Run once: ./scripts/install-cloudflared-macos.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_HOME="$HOME"
LAUNCH_AGENTS="$USER_HOME/Library/LaunchAgents"

cd "$REPO_ROOT"

echo "=== Install Cloudflare Tunnel + Watchdog on macOS ==="

# 1. Check cloudflared
if ! command -v cloudflared &> /dev/null; then
  echo "Installing cloudflared via Homebrew..."
  brew install cloudflared
else
  echo "cloudflared found: $(cloudflared --version)"
fi

# 2. Login to Cloudflare (if not already)
if [[ ! -f "$USER_HOME/.cloudflared/cert.pem" ]]; then
  echo "Logging in to Cloudflare..."
  cloudflared tunnel login
else
  echo "Cloudflare cert already exists"
fi

# 3. Create launchd plist for cloudflared
mkdir -p "$LAUNCH_AGENTS"

cat > "$LAUNCH_AGENTS/com.autodev.cloudflared.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.autodev.cloudflared</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--url</string>
        <string>http://localhost:4000</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/cloudflared.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cloudflared.err</string>
    <key>WorkingDirectory</key>
    <string>REPO_ROOT_PLACEHOLDER</string>
</dict>
</plist>
PLIST_EOF

sed -i '' "s|REPO_ROOT_PLACEHOLDER|$REPO_ROOT|g" "$LAUNCH_AGENTS/com.autodev.cloudflared.plist"

# 4. Create launchd plist for watchdog (runs every 5 min via StartInterval)
cat > "$LAUNCH_AGENTS/com.autodev.watchdog-ngrok.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.autodev.watchdog-ngrok</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>REPO_ROOT_PLACEHOLDER/scripts/watchdog-ngrok.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/watchdog-ngrok.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/watchdog-ngrok.err</string>
    <key>WorkingDirectory</key>
    <string>REPO_ROOT_PLACEHOLDER</string>
</dict>
</plist>
PLIST_EOF

sed -i '' "s|REPO_ROOT_PLACEHOLDER|$REPO_ROOT|g" "$LAUNCH_AGENTS/com.autodev.watchdog-ngrok.plist"

# 5. Load agents
echo "Loading launchd agents..."
launchctl unload "$LAUNCH_AGENTS/com.autodev.cloudflared.plist" 2>/dev/null || true
launchctl unload "$LAUNCH_AGENTS/com.autodev.watchdog-ngrok.plist" 2>/dev/null || true

launchctl load "$LAUNCH_AGENTS/com.autodev.cloudflared.plist"
launchctl load "$LAUNCH_AGENTS/com.autodev.watchdog-ngrok.plist"

# 6. Vercel token reminder
echo ""
echo "=== Vercel Token Required for Watchdog ==="
echo "Create token at: https://vercel.com/account/tokens"
echo "Then run:"
echo "  echo 'YOUR_VERCEL_TOKEN' > ~/.vercel_token"
echo "  chmod 600 ~/.vercel_token"
echo ""

# 7. Status
echo ""
echo "=== Status ==="
launchctl list | grep autodev || true
echo ""
echo "Logs:"
echo "  Cloudflared: tail -f /tmp/cloudflared.log"
echo "  Watchdog:    tail -f /tmp/watchdog-ngrok.log"
echo ""
echo "To restart:"
echo "  launchctl kickstart -k gui/$(id -u)/com.autodev.cloudflared"
echo "  launchctl kickstart -k gui/$(id -u)/com.autodev.watchdog-ngrok"