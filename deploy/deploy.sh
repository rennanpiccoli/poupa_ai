#!/usr/bin/env bash
# Runs ON THE VPS. Usage: ./deploy/deploy.sh <tag>
# Backs up the DB, applies migrations, starts the new version, checks health,
# and rolls back to the last good version if the healthcheck fails.
# Note: rollback restores the app image, NOT the schema — keep migrations backward compatible.
set -euo pipefail

TAG="${1:?usage: deploy.sh <tag>}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"
STATE_FILE=".last_good_tag"
cd "$(dirname "$0")/.."
set -a; source .env; set +a

up() {
  IMAGE_TAG="$1" docker compose pull app
  IMAGE_TAG="$1" docker compose up -d --remove-orphans
}

healthy() {
  for _ in $(seq 1 30); do
    curl -fsS "$HEALTHCHECK_URL" >/dev/null 2>&1 && return 0
    sleep 5
  done
  return 1
}

echo "→ deploy $TAG"
IMAGE_TAG="$TAG" docker compose pull app

echo "→ backup do banco"
mkdir -p backups
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backups/pre-$TAG.sql.gz" || echo "⚠ backup falhou (primeiro deploy?)"
ls -1t backups/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "→ migrations"
IMAGE_TAG="$TAG" docker compose run --rm migrate

up "$TAG"

if healthy; then
  echo "$TAG" > "$STATE_FILE"
  docker image prune -f >/dev/null
  echo "✅ $TAG no ar"
else
  echo "❌ healthcheck falhou para $TAG"
  if [[ -f "$STATE_FILE" ]]; then
    PREV="$(cat "$STATE_FILE")"
    echo "↩ voltando para $PREV"
    up "$PREV"
  fi
  exit 1
fi
