#!/usr/bin/env bash
# Dumps the production database into backups/ and prints the path of the file.
# Works only in the prod folder: there are no staging backups.
# The file name holds the app version running now (from current-image), so a
# backup taken by deploy.sh names the version from before the deploy.
# Needs the db container running.
#
# Usage: backup.sh [suffix]
#   suffix: appended to the file name, e.g. "before-restore"
set -euo pipefail

suffix="${1:-}"

cd "$(dirname "$0")"
source ./lib.sh
if [ "$env_name" != prod ]; then
  echo "Backups are made only on prod: the staging database is a copy of a prod backup" >&2
  exit 1
fi
require_env

current=$(cat current-image 2>/dev/null || true)
version="${current##*:}"
# compose.yml needs APP_IMAGE even when only the database is used
export APP_IMAGE="${APP_IMAGE:-${current:-none}}"

umask 077
mkdir -p backups
chmod 700 backups
file="$PWD/backups/$(date -u +%Y-%m-%d_%H-%M-%S)_${version:-unknown}${suffix:+_$suffix}.dump"

# Dump into a temporary name first: a failed dump never looks like a backup
trap 'rm -f "$file.partial"' EXIT
# shellcheck disable=SC2016 # the variables expand inside the db container
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  </dev/null >"$file.partial"
mv "$file.partial" "$file"
echo "$file"
