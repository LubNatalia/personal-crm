#!/usr/bin/env bash
# Manual rollback, run by hand on the server: starts the previous app image again.
# Migrations are not reverted: the previous version runs on the current database.
set -euo pipefail

cd "$(dirname "$0")"
previous=$(cat previous-image 2>/dev/null || true)
if [ -z "$previous" ]; then
  echo "No previous image recorded yet: nothing to roll back to" >&2
  exit 1
fi

echo "Rolling back to $previous"
exec bash ./deploy.sh "$previous"
