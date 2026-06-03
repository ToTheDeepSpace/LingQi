#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-master}"
SERVER_HOST="${TENCENT_SERVER_HOST:-ubuntu@175.27.166.150}"
SERVER_DIR="${TENCENT_LINGQI_DIR:-/srv/jusichen/LingQi}"
SSH_KEY="${TENCENT_SSH_KEY:-/Users/mima0000/.ssh/tencent_lighthouse_codex}"

cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit changes before deploying." >&2
  git status --short >&2
  exit 1
fi

git push origin "$BRANCH"

ssh -i "$SSH_KEY" "$SERVER_HOST" \
  "set -euo pipefail
   cd '$SERVER_DIR'
   git fetch origin '$BRANCH'
   git checkout '$BRANCH'
   git pull --ff-only origin '$BRANCH'
   npm ci
   npm run build:tencent
   sudo systemctl restart lingqi.service
   systemctl is-active lingqi.service"

curl -fsS https://lingqi.jusichen.com/api/health >/dev/null
echo "LingQi deployed to https://lingqi.jusichen.com"
