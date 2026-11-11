#!/usr/bin/env bash
# Deploys one app image to the environment this folder belongs to (see lib.sh):
# pull -> database backup (prod only) -> migrations in a one-off container ->
# new app container -> smoke /health. After a good prod deploy it also makes
# sure the daily backup is scheduled and removes old app images.
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

# Adds the daily backup to the crontab of this user, at 03:00 Moscow time
# converted to the server's time zone (cron runs in that one). Only the line
# of this script is replaced: other crontab lines are kept as they are
install_backup_schedule() {
  local script="$PWD/daily-backup.sh" when line current_tab
  # Called as "if ! install_backup_schedule": set -e is off inside, so every
  # step that can fail returns on its own
  when=$(date -d 'TZ="Europe/Moscow" 03:00' +'%-M %-H') || return 1
  line="$when * * * bash $script 2>&1 | logger -t crm-daily-backup"
  current_tab=$(crontab -l 2>/dev/null || true)
  if grep --quiet --line-regexp --fixed-strings "$line" <<<"$current_tab"; then
    echo "Already scheduled: $line"
    return 0
  fi
  {
    if [ -n "$current_tab" ]; then
      printf '%s\n' "$current_tab" | { grep --invert-match --fixed-strings "$script" || true; }
    fi
    echo "$line"
  } | crontab - || return 1
  echo "Scheduled: $line"
}

# Removes app images built more than 2 weeks ago, except the current and the
# previous prod versions and the current staging version. Only images of this
# app: the other images on the shared server are never touched. Best effort:
# an image that can't be removed now is removed by a later deploy
remove_old_images() {
  local repo="${image%:*}" keep=() file ref created created_s cutoff
  for file in current-image previous-image ../staging/current-image; do
    if [ -s "$file" ]; then
      keep+=("$(cat "$file")")
    fi
  done
  echo "Keeping ${keep[*]}"
  cutoff=$(date -d '14 days ago' +%s)
  docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}' | sort --unique | while read -r ref; do
    if [ "${ref##*:}" = "<none>" ] \
      || printf '%s\n' "${keep[@]}" | grep --quiet --line-regexp --fixed-strings "$ref"; then
      continue
    fi
    created=$(docker image inspect --format '{{.Created}}' "$ref" 2>/dev/null) || continue
    created_s=$(date -d "$created" +%s 2>/dev/null) || continue
    if [ "$created_s" -lt "$cutoff" ]; then
      if docker image rm "$ref" >/dev/null; then
        echo "Removed $ref"
      else
        echo "Could not remove $ref" >&2
      fi
    fi
  done
}

echo "==> Environment $env_name, image $image"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  if [ -n "$registry_user" ]; then
    # A login of its own: the staging and prod deploys can run at the same
    # time, and one logging out must not break the other one's pull
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
  if ! backup=$(bash ./backup.sh deploy); then
    echo "Backup FAILED: the new version was not started, the old one keeps running" >&2
    exit 1
  fi
  echo "Saved $backup"
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
  if [ "$env_name" = prod ]; then
    echo "The new version is running but broken. Nothing was rolled back: to go back run Deploy prod with \"rollback\" checked" >&2
  else
    echo "The new version is running but broken. Nothing was rolled back" >&2
  fi
  exit 1
fi

if [ "$env_name" = prod ]; then
  echo "==> Daily backup schedule"
  if ! install_backup_schedule; then
    echo "Deployed $image, but the daily backup could not be scheduled: see the error above" >&2
    exit 1
  fi

  echo "==> Cleanup: app images older than 2 weeks"
  remove_old_images || echo "Cleanup of old images failed: a later deploy tries again" >&2
fi

echo "Deployed $image to $env_name"
