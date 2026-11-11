#!/usr/bin/env bash
# Rollback: starts the previous app image of the environment this folder
# belongs to again (see lib.sh), through deploy.sh, so prod gets a backup first.
# Prod: run by the Deploy prod workflow with "rollback" checked (ci.sh
# --rollback), never automatically. Staging: by hand on the server; works while
# the previous staging image is still on the server.
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
