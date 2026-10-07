#!/usr/bin/env bash
# generate-env-local.sh — Generate .env.local from template for local development
# Usage: ./scripts/generate-env-local.sh

set -euo pipefail

TEMPLATE=".env.production.template"
OUTPUT=".env.local"
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
  sed "s|^API_DOMAIN=.*|API_DOMAIN=api.localhost|" | \
  sed "s|^LIVE_DOMAIN=.*|LIVE_DOMAIN=live.localhost|" | \
  sed "s|^GITEA_DOMAIN=.*|GITEA_DOMAIN=git.localhost|" | \
  sed "s|^MINIO_DOMAIN=.*|MINIO_DOMAIN=s3.localhost|" | \
  sed "s|^DASHBOARD_DOMAIN=.*|DASHBOARD_DOMAIN=http://localhost:3000|" | \
  sed "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" | \
  sed "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" | \
  sed "s|^SETTINGS_KEY=.*|SETTINGS_KEY=$SETTINGS_KEY|" | \
  sed "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@autodev.local|" | \
  sed "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=AutoDevLocal2026!|" | \
  sed "s|^RUNNER_TOKEN=.*|RUNNER_TOKEN=$RUNNER_TOKEN|" | \
  sed "s|^LLM_MODE=.*|LLM_MODE=mock|" | \
  sed "s|^LLM_PROVIDER=.*|LLM_PROVIDER=openai|" | \
  sed "s|^LLM_MODEL=.*|LLM_MODEL=gpt-4o-mini|" | \
  sed "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=|" | \
  sed "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=|" | \
  sed "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=|" | \
  sed "s|^EMAIL_PROVIDER=.*|EMAIL_PROVIDER=smtp|" | \
  sed "s|^EMAIL_FROM=.*|EMAIL_FROM=AutoDev Office <office@autodev.local>|" | \
  sed "s|^SMTP_HOST=.*|SMTP_HOST=mailpit|" | \
  sed "s|^SMTP_PORT=.*|SMTP_PORT=1025|" | \
  sed "s|^SMTP_SECURE=.*|SMTP_SECURE=false|" | \
  sed "s|^SMTP_USER=.*|SMTP_USER=|" | \
  sed "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=|" | \
  sed "s|^RESEND_API_KEY=.*|RESEND_API_KEY=|" | \
  sed "s|^MINIO_ROOT_USER=.*|MINIO_ROOT_USER=autodev|" | \
  sed "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD|" | \
  sed "s|^S3_REGION=.*|S3_REGION=us-east-1|" | \
  sed "s|^S3_BUCKET=.*|S3_BUCKET=autodev-artifacts|" | \
  sed "s|^S3_ENDPOINT=.*|S3_ENDPOINT=http://localhost:9000|" | \
  sed "s|^BACKUP_RETENTION_DAYS=.*|BACKUP_RETENTION_DAYS=30|" | \
  sed "s|^GITEA_USER=.*|GITEA_USER=autodev|" | \
  sed "s|^GITEA_PASSWORD=.*|GITEA_PASSWORD=AutoDevGitLocal2026!|" | \
  sed "s|^GITEA_TOKEN=.*|GITEA_TOKEN=|" | \
  sed "s|^DEPLOY_TARGET=.*|DEPLOY_TARGET=docker-local|" | \
  sed "s|^COOLIFY_URL=.*|COOLIFY_URL=|" | \
  sed "s|^COOLIFY_TOKEN=.*|COOLIFY_TOKEN=|" | \
  sed "s|^COOLIFY_APP_UUID=.*|COOLIFY_APP_UUID=|" | \
  sed "s|^COOLIFY_PUBLIC_URL=.*|COOLIFY_PUBLIC_URL=|" | \
  sed "s|^UAT_PROXY_URL=.*|UAT_PROXY_URL=|" | \
  sed "s|^UAT_EGRESS_NETWORK=.*|UAT_EGRESS_NETWORK=|" > "$OUTPUT"

echo "✅ $OUTPUT created"
echo ""
echo "Next steps:"
echo "  1. Review $OUTPUT (secrets already generated)"
echo "  2. Run: docker compose up -d"
echo "  3. Run: pnpm dev:all"
echo ""
echo "Note: For local dev, API_URL is read from rewrites (http://localhost:4000)."
echo "      No need to set API_URL in .env.local unless using tunnel."