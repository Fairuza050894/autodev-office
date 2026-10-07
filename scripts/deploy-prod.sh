#!/usr/bin/env bash
# deploy-prod.sh - Deploy AutoDev Office ke VPS production
# Usage: ./scripts/deploy-prod.sh [user@host] [--skip-build]

set -euo pipefail

REMOTE="${1:-}"
SKIP_BUILD="${2:-}"

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 user@host [--skip-build]"
  echo "Example: $0 root@192.168.1.100"
  exit 1
fi

REPO_DIR="/opt/autodev-office"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

echo "=== Deploy AutoDev Office ke $REMOTE ==="

# 1. Check local files
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: $COMPOSE_FILE tidak ditemukan di $(pwd)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE tidak ditemukan. Copy dari .env.production.template dan isi!"
  exit 1
fi

if [[ ! -f "Caddyfile" ]]; then
  echo "Error: Caddyfile tidak ditemukan"
  exit 1
fi

# 2. Sync files to VPS
echo "--- Sync files ke VPS ---"
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '*.log' \
  --exclude '.env.production' \
  --exclude 'coverage' \
  --exclude 'test-results' \
  --exclude '.turbo' \
  ./ "$REMOTE:$REPO_DIR/"

# 3. Copy env file separately (not in rsync exclude)
scp "$ENV_FILE" "$REMOTE:$REPO_DIR/.env.production"

# 4. Remote deploy
echo "--- Remote deploy ---"
ssh "$REMOTE" bash -s -- "$SKIP_BUILD" << 'ENDSSH'
set -euo pipefail
SKIP_BUILD="${1:-}"
cd /opt/autodev-office

# Load env
set -a
source .env.production
set +a

# Install docker & compose if needed
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version &> /dev/null; then
  echo "Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

# Build images (skip if --skip-build)
if [[ "$SKIP_BUILD" != "--skip-build" ]]; then
  echo "Building images..."
  docker compose -f docker-compose.prod.yml build --pull
fi

# Pull base images
docker compose -f docker-compose.prod.yml pull postgres redis minio/minio:RELEASE.2024-01-16T16-07-33Z gitea/gitea:1.23.7 caddy:2.8-alpine node:22-bookworm-slim

# Start stack
echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Wait for healthchecks
echo "Waiting for services to be healthy..."
sleep 10

# Check health
for i in {1..30}; do
  HEALTHY=$(docker compose -f docker-compose.prod.yml ps --format json | jq -r 'select(.Health != "healthy" and .Health != "") | .Service' | wc -l)
  if [[ "$HEALTHY" -eq 0 ]]; then
    echo "All services healthy!"
    break
  fi
  echo "Waiting... ($i/30) - $HEALTHY services not healthy yet"
  sleep 10
done

# Show status
docker compose -f docker-compose.prod.yml ps

# Test endpoints
echo "--- Testing endpoints ---"
curl -sf "https://$API_DOMAIN/api/v1/health" | jq . || echo "API health check failed"
curl -sf "https://$API_DOMAIN/health" | jq . || echo "Root health check failed"

echo "=== Deploy complete ==="
echo "Dashboard: https://$DASHBOARD_DOMAIN"
echo "API: https://$API_DOMAIN"
echo "Live: https://$LIVE_DOMAIN"
echo "Gitea: https://$GITEA_DOMAIN"
echo "MinIO: https://$MINIO_DOMAIN"
ENDSSH

echo "=== Deploy selesai ==="