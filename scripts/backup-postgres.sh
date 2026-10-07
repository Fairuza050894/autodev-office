#!/usr/bin/env bash
# backup-postgres.sh - Daily PostgreSQL backup to S3/R2
# Runs inside postgres container via cron

set -euo pipefail

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d-%H%M%S)
FILE="autodev-$DATE.sql.gz"
S3_BUCKET="${S3_BUCKET:-autodev-backups}"
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.autodev.example.com}"
S3_ACCESS_KEY="${S3_ACCESS_KEY}"
S3_SECRET_KEY="${S3_SECRET_KEY}"
S3_REGION="${S3_REGION:-us-east-1}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Dump database (PGHOST/PGUSER/PGPASSWORD dari environment)
pg_dump -h "${PGHOST:-postgres}" -U autodev -d autodev --no-owner --no-privileges | gzip > "$BACKUP_DIR/$FILE"

# Upload to S3 (using aws cli or rclone)
if command -v aws &> /dev/null; then
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws --endpoint-url "$S3_ENDPOINT" s3 cp "$BACKUP_DIR/$FILE" "s3://$S3_BUCKET/postgres/$FILE" --region "$S3_REGION"
  echo "[$(date)] Uploaded to S3"
else
  echo "aws cli not found, skipping S3 upload"
fi

# Cleanup old local backups
find "$BACKUP_DIR" -name "autodev-*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Cleanup old S3 backups (if aws cli available)
if command -v aws &> /dev/null; then
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$S3_BUCKET/postgres/" --region "$S3_REGION" | \
  while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_NAME=$(echo "$line" | awk '{print $4}')
    if [[ $(date -d "$FILE_DATE" +%s) -lt $(date -d "$RETENTION_DAYS days ago" +%s) ]]; then
      aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$S3_BUCKET/postgres/$FILE_NAME" --region "$S3_REGION"
    fi
  done
fi

echo "[$(date)] Backup complete: $FILE"