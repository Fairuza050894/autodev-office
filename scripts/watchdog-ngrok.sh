#!/usr/bin/env bash
# watchdog-ngrok.sh — Monitor Cloudflare Tunnel & update Vercel API_URL if changed
# Runs as systemd timer (every 5 min) or cron

set -euo pipefail

VERCEL_PROJECT="autodev-office"
NGROK_API="http://localhost:4040/api/tunnels"
VERCEL_TOKEN_FILE="${HOME}/.vercel_token"
LOG_FILE="${HOME}/.cloudflared-watchdog.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

get_current_tunnel_url() {
  curl -sf "$NGROK_API" 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); [print(t['public_url']) for t in d['tunnels'] if t['proto']=='https']" | head -1
}

update_vercel_env() {
  local new_url="$1"
  if [[ -z "$new_url" ]]; then
    log "ERROR: empty tunnel URL"
    return 1
  fi
  if [[ ! -f "$VERCEL_TOKEN_FILE" ]]; then
    log "ERROR: Vercel token file not found at $VERCEL_TOKEN_FILE"
    log "Create it: echo 'your-vercel-token' > ~/.vercel_token && chmod 600 ~/.vercel_token"
    return 1
  fi
  local token
  token=$(cat "$VERCEL_TOKEN_FILE")
  log "Updating Vercel API_URL to $new_url"
  printf "%s" "$new_url" | vercel env add API_URL production --force --token "$token" 2>&1 | tail -1 | tee -a "$LOG_FILE"
  printf "%s" "$new_url" | vercel env add API_URL preview --force --token "$token" 2>&1 | tail -1 | tee -a "$LOG_FILE"
  # Trigger redeploy
  log "Triggering Vercel redeploy..."
  vercel deploy --prod --yes --token "$token" 2>&1 | tail -3 | tee -a "$LOG_FILE"
}

main() {
  log "=== Watchdog started ==="
  local current_url
  current_url=$(get_current_tunnel_url)
  if [[ -z "$current_url" ]]; then
    log "No active tunnel found"
    exit 1
  fi
  log "Current tunnel: $current_url"

  # Check if Vercel env matches (optional: compare with last known)
  local last_url_file="${HOME}/.last_tunnel_url"
  local last_url=""
  [[ -f "$last_url_file" ]] && last_url=$(cat "$last_url_file")

  if [[ "$current_url" != "$last_url" ]]; then
    log "Tunnel URL changed: $last_url -> $current_url"
    if update_vercel_env "$current_url"; then
      echo "$current_url" > "$last_url_file"
      log "Vercel updated successfully"
    else
      log "Failed to update Vercel"
      exit 1
    fi
  else
    log "Tunnel URL unchanged"
  fi
}

main "$@"