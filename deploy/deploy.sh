#!/usr/bin/env bash
# Deploys one app image to the environment this folder belongs to (see lib.sh):
# pull -> database backup (prod only) -> migrations in a one-off container ->
# new app container -> smoke /health.
# There is no automatic rollback: on any failure the script stops with an error.
#
# Usage: deploy.sh <image> [registry-user]
#   registry-user: log in to ghcr.io with the token from stdin before pulling
set -euo pipefail

image="${1:?Usage: deploy.sh <image> [registry-user]}"
registry_user="${2:-}"

registry_token=""
if [ -n "$registry_user" ]; then
  registry_token=$(cat)
fi
# Nothing below reads stdin, so the token can't leak into a container
exec </dev/null

cd "$(dirname "$0")"
source ./lib.sh
require_env
acquire_lock

echo "==> Environment $env_name, image $image"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  if [ -n "$registry_user" ]; then
    # A login of its own: the staging and prod deploys run at the same time,
    # and one logging out must not break the other one's pull
    registry_config=$(mktemp -d)
    trap 'rm -rf "$registry_config"' EXIT
    printf '%s\n' "$registry_token" \
      | DOCKER_CONFIG="$registry_config" docker login ghcr.io --username "$registry_user" --password-stdin >/dev/null
    DOCKER_CONFIG="$registry_config" docker pull "$image"
  else
    docker pull "$image"
  fi
fi
export APP_IMAGE="$image"

echo "==> Database"
"${compose[@]}" up --detach --wait db

if [ "$env_name" = prod ]; then
  echo "==> Backup"
  if ! backup=$(bash ./backup.sh); then
    echo "Backup FAILED: the new version was not started, the old one keeps running" >&2
    exit 1
  fi
  echo "Saved $backup"
  # Keep only the 10 newest backups: the names start with the date, so they sort by time
  printf '%s\n' backups/*.dump | sort --reverse | tail -n +11 | xargs --no-run-if-empty rm --
fi

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

if ! smoke_test; then
  echo "The new version is running but broken. Nothing was rolled back: to go back run rollback.sh" >&2
  exit 1
fi

echo "==> Cleanup: keep the current and the previous app images of every environment"
# The environments share the server and the images: this folder's neighbours
# (../prod, ../staging) say which images they still need
keep=("$image")
for file in ../*/current-image ../*/previous-image; do
  if [ -s "$file" ]; then
    keep+=("$(cat "$file")")
  fi
done
keep_patterns=()
for kept in "${keep[@]}"; do
  keep_patterns+=(-e "$kept")
done
# Best effort: an image that can't be removed now is removed by a later deploy
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' \
  | { grep --invert-match --line-regexp --fixed-strings "${keep_patterns[@]}" || true; } \
  | xargs --no-run-if-empty docker image rm || echo "Some old images were not removed" >&2

echo "Deployed $image to $env_name"
