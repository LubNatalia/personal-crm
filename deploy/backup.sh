#!/usr/bin/env bash
# Dumps the production database into backups/ and prints the path of the file,
# then removes the oldest backups of the same kind (lib.sh, prune_backups).
# Works only in the prod folder: there are no staging backups.
# The file name holds the app version running now (from current-image), so a
# backup taken by deploy.sh names the version from before the deploy.
# Needs the db container running.
#
# Usage: backup.sh [kind]
#   kind: deploy, daily, manual (the default) or before-restore
set -euo pipefail

kind="${1:-manual}"

cd "$(dirname "$0")"
source ./lib.sh
if [ "$env_name" != prod ]; then
  echo "Backups are made only on prod: the staging database is a copy of a prod backup" >&2
  exit 1
fi
case " $backup_kinds " in
  *" $kind "*) ;;
  *)
    echo "Unknown backup kind \"$kind\": use one of $backup_kinds" >&2
    exit 1
    ;;
esac
require_env

current=$(cat current-image 2>/dev/null || true)
version="${current##*:}"
# compose.yml needs APP_IMAGE even when only the database is used
export APP_IMAGE="${APP_IMAGE:-${current:-none}}"

umask 077
mkdir -p backups
chmod 700 backups
file="$PWD/backups/$(date -u +%Y-%m-%d_%H-%M-%S)_${version:-unknown}_$kind.dump"

# Dump into a temporary name first: a failed dump never looks like a backup
trap 'rm -f "$file.partial"' EXIT
# shellcheck disable=SC2016 # the variables expand inside the db container
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  </dev/null >"$file.partial"
mv "$file.partial" "$file"
prune_backups "$kind"
echo "$file"
