#!/bin/bash
set -euo pipefail

APP_DIR="/www/wwwroot/performance-report.apotekkuapp.com"
SSH_KEY="$HOME/.ssh/dasbor_hgpga_deploy"
BRANCH="main"

echo "=== Deploy performance-report.apotekkuapp.com ==="
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

cd "$APP_DIR"

echo "[1/4] Pull latest code from GitHub..."
GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  git pull origin "$BRANCH"

echo "[2/4] Check for migration changes..."
if git diff HEAD@{1}..HEAD --name-only | grep -q "prisma/migrations/"; then
  echo "  → Migration detected, running prisma migrate deploy..."
  DATABASE_URL="mysql://dasbor_user:DasborHgp%402026%21@localhost:3306/dashboardhgpga" \
    npx prisma migrate deploy
else
  echo "  → No migration changes."
fi

echo "[3/4] Rebuild Docker image..."
docker compose build --no-cache

echo "[4/4] Restart container..."
docker compose up -d

echo ""
echo "=== Deploy complete ==="
docker compose ps
