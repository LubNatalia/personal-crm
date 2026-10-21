#!/usr/bin/env bash
# Deploys one app image on the server:
# pull -> migrations in a one-off container -> new app container -> smoke /health.
# There is no automatic rollback: on any failure the script stops with an error.
#
# Usage: deploy.sh <image> [registry-user]
#   registry-user: log in to ghcr.io with the token from stdin before pulling
set -euo pipefail

image="${1:?Usage: deploy.sh <image> [registry-user]}"
registry_user="${2:-}"
health_url=http://127.0.0.1:3000/health

registry_token=""
if [ -n "$registry_user" ]; then
  registry_token=$(cat)
fi
# Nothing below reads stdin, so the token can't leak into a container
exec </dev/null

cd "$(dirname "$0")"
compose=(docker compose -p prod -f compose.yml)

if [ ! -f .env ]; then
  echo "No .env in $PWD: create it first (see README)" >&2
  exit 1
fi
chmod 600 .env

echo "==> Image $image"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  if [ -n "$registry_user" ]; then
    printf '%s\n' "$registry_token" \
      | docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
    trap 'docker logout ghcr.io >/dev/null' EXIT
  fi
  docker pull --quiet "$image"
fi
export APP_IMAGE="$image"

echo "==> Database"
"${compose[@]}" up --detach --wait db

echo "==> Migrations"
if ! "${compose[@]}" run --rm --no-TTY migrate; then
  echo "Migrations FAILED: the new version was not started, the old one keeps running" >&2
  exit 1
fi

echo "==> App"
"${compose[@]}" up --detach app
current=$(cat current-image 2>/dev/null || true)
if [ "$current" != "$image" ]; then
  if [ -n "$current" ]; then
    echo "$current" > previous-image
  fi
  echo "$image" > current-image
fi

echo "==> Smoke test $health_url"
status=000
for _ in $(seq 30); do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$health_url" || true)
  if [ "$status" = 200 ]; then
    break
  fi
  sleep 2
done
if [ "$status" != 200 ]; then
  echo "Smoke test FAILED: $health_url answered $status." >&2
  echo "The new version is running but broken. Nothing was rolled back: to go back run rollback.sh" >&2
  "${compose[@]}" logs --tail 50 app >&2
  exit 1
fi
echo "Smoke test passed: $health_url answered 200"

echo "==> Cleanup: keep only the current and the previous app images"
previous=$(cat previous-image 2>/dev/null || true)
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' \
  | { grep --invert-match --line-regexp --fixed-strings -e "$image" -e "${previous:-$image}" || true; } \
  | xargs --no-run-if-empty docker image rm

echo "Deployed $image"
