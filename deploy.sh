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
PREVIOUS_REVISION="$(git rev-parse HEAD)"
GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git pull origin "$BRANCH"
CURRENT_REVISION="$(git rev-parse HEAD)"

echo "[2/4] Check for migration changes..."
if git diff "$PREVIOUS_REVISION" "$CURRENT_REVISION" --name-only -- prisma/migrations/ | grep -q .; then
  echo "  → Migration detected, running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "  → No migration changes."
fi

echo "[3/4] Rebuild Docker image..."
docker compose build --pull

echo "[4/4] Restart container..."
docker compose up -d --remove-orphans

echo ""
echo "=== Deploy complete ==="
docker compose ps
