#!/usr/bin/env bash
# Manual restore, run by hand on the server: replaces the production database
# with a backup file made by backup.sh. Asks for "yes" before changing anything,
# saves a copy of the current database, then: stop the app -> drop and recreate
# the database -> load the backup -> migrations of the running version ->
# start the same app version -> smoke /health.
# The app version does not change. Nothing is rolled back automatically.
#
# Usage: restore.sh <backup-file>
set -euo pipefail

backup="${1:?Usage: restore.sh <backup-file>}"
if [ ! -s "$backup" ]; then
  echo "No such backup file, or it is empty: $backup" >&2
  exit 1
fi
backup=$(realpath -- "$backup")

cd "$(dirname "$0")"
source ./lib.sh
require_env

current=$(cat current-image 2>/dev/null || true)
if [ -z "$current" ]; then
  echo "No current-image in $PWD: the app was never deployed here" >&2
  exit 1
fi
export APP_IMAGE="$current"

"${compose[@]}" up --detach --wait db
if ! "${compose[@]}" exec -T db pg_restore --list <"$backup" >/dev/null; then
  echo "Not a backup made by backup.sh, pg_restore cannot read it: $backup" >&2
  exit 1
fi
database=$("${compose[@]}" exec -T db printenv POSTGRES_DB </dev/null)

echo
echo "Backup file:  $backup"
echo "              $(du -h -- "$backup" | cut -f1), made $(date -r "$backup" '+%Y-%m-%d %H:%M:%S %Z')"
echo "Database:     $database"
echo "App version:  $current (stays the same)"
echo
echo "The database \"$database\" will be DELETED and replaced with this backup."
echo "A copy of the current database is saved first."
read -r -p 'Type "yes" to continue: ' answer
if [ "$answer" != yes ]; then
  echo "Cancelled: nothing was changed"
  exit 1
fi

echo "==> Copy of the current database"
safety=$(bash ./backup.sh before-restore)
echo "Saved $safety"

trap 'echo "Restore FAILED: the app may be stopped. To bring back the data from before the restore run: bash $PWD/restore.sh $safety" >&2' ERR

echo "==> Stop the app"
"${compose[@]}" stop app

echo "==> Recreate the database $database"
# shellcheck disable=SC2016 # the variables expand inside the db container
"${compose[@]}" exec -T db sh -c \
  'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  </dev/null

echo "==> Load the backup"
# shellcheck disable=SC2016 # the variables expand inside the db container
"${compose[@]}" exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error --single-transaction' \
  <"$backup"

echo "==> Migrations of the running version"
"${compose[@]}" run --rm --no-TTY migrate </dev/null

echo "==> App $current"
"${compose[@]}" up --detach app
trap - ERR

if ! smoke_test; then
  echo "The database is restored, but the app does not answer. Nothing was rolled back." >&2
  echo "The copy of the database from before the restore: $safety" >&2
  exit 1
fi
echo "Restored $backup into $database"
