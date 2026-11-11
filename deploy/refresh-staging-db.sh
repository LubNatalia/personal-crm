#!/usr/bin/env bash
# Makes the staging database a copy of prod: loads the newest prod backup
# (/opt/crm/prod/backups, not the "_before-restore" copies) into staging with
# restore.sh. Run by hand on the server when staging is first set up or its
# data got broken. Deploys never touch the staging data.
#
# Usage: refresh-staging-db.sh [--yes]
#   --yes: don't ask before replacing the staging database
set -euo pipefail

cd "$(dirname "$0")"
if [ "$(basename "$PWD")" != staging ]; then
  echo "Run this from the staging folder: bash /opt/crm/staging/refresh-staging-db.sh" >&2
  exit 1
fi

# The names start with the date, so the last one in sort order is the newest
newest=$(printf '%s\n' ../prod/backups/*.dump | { grep --invert-match -e '_before-restore\.dump$' -e '\*' || true; } | sort | tail -n 1)
if [ -z "$newest" ]; then
  echo "No prod backups in $(realpath ../prod)/backups: run bash /opt/crm/prod/backup.sh first" >&2
  exit 1
fi

exec bash ./restore.sh "$newest" "$@"
