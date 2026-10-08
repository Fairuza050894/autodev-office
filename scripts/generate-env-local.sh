#!/usr/bin/env bash
# generate-env-local.sh — Generate .env from .env.example for local development
# Usage: ./scripts/generate-env-local.sh

set -euo pipefail

TEMPLATE=".env.example"
OUTPUT=".env"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Error: $TEMPLATE not found"
  exit 1
fi

echo "Generating $OUTPUT from $TEMPLATE..."

# Generate random secrets (URL-safe, no + / =)
gen_secret() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; }
gen_password() { openssl rand -base64 24 | tr '+/' '-_' | tr -d '=\n'; }

# Read template, replace placeholders (using | as delimiter)
POSTGRES_PASSWORD=$(gen_password)
SESSION_SECRET=$(gen_secret)
SETTINGS_KEY=$(gen_secret)
RUNNER_TOKEN=$(gen_secret)
MINIO_ROOT_PASSWORD=$(gen_password)

cat "$TEMPLATE" | \
  sed "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" | \
  sed "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" | \
  sed "s|^SETTINGS_KEY=.*|SETTINGS_KEY=$SETTINGS_KEY|" | \
  sed "s|^RUNNER_TOKEN=.*|RUNNER_TOKEN=$RUNNER_TOKEN|" | \
  sed "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD|" | \
  sed "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@autodev.local|" | \
  sed "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=AutoDevLocal2026!|" | \
  sed "s|^LLM_MODE=.*|LLM_MODE=mock|" | \
  sed "s|^PUBLIC_URL=.*|PUBLIC_URL=http://localhost:4000|" | \
  sed "s|^DASHBOARD_URL=.*|DASHBOARD_URL=http://localhost:3000|" | \
  sed "s|^PUBLIC_LIVE_URL=.*|PUBLIC_LIVE_URL=http://127.0.0.1:4400|" | \
  sed "s|^SMTP_HOST=.*|SMTP_HOST=mailpit|" | \
  sed "s|^SMTP_PORT=.*|SMTP_PORT=1025|" | \
  sed "s|^SMTP_SECURE=.*|SMTP_SECURE=false|" | \
  sed "s|^GITEA_PASSWORD=.*|GITEA_PASSWORD=AutoDevGitLocal2026!|" | \
  sed "s|^DEPLOY_TARGET=.*|DEPLOY_TARGET=docker-local|" | \
  sed "s|^SNAPSHOT_RETENTION_DAYS=.*|SNAPSHOT_RETENTION_DAYS=30|" > "$OUTPUT"

echo "✅ $OUTPUT created"
echo ""
echo "Next steps:"
echo "  1. Review $OUTPUT (secrets already generated)"
echo "  2. Run: docker compose up -d"
echo "  3. Run: pnpm dev:all"
echo ""
echo "Note: For local dev, API_URL is read from rewrites (http://localhost:4000)."
echo "      No need to set API_URL in .env unless using tunnel."
