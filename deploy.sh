#!/bin/bash
set -euo pipefail

APP_DIR="/www/wwwroot/performance-report.apotekkuapp.com"
SSH_KEY="$HOME/.ssh/dasbor_hgpga_deploy"
BRANCH="main"

echo "=== Deploy performance-report.apotekkuapp.com ==="
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: File .env tidak ditemukan di $APP_DIR."
  exit 1
fi

echo "[1/4] Pull latest code from GitHub..."
GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git pull origin "$BRANCH"

echo "[2/4] Apply pending database migrations..."
# Safe to repeat: a previous deploy may have pulled code before its migration failed.
npx prisma migrate deploy

echo "[3/4] Rebuild Docker image..."
docker compose build --pull

echo "[4/4] Restart container..."
docker compose up -d --remove-orphans

echo ""
echo "=== Deploy complete ==="
docker compose ps
