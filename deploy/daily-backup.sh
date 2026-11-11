#!/usr/bin/env bash
# Daily backup of the prod database. Run by cron at 03:00 Moscow time: the
# schedule is installed by deploy.sh on every prod deploy. Takes the deploy
# lock, so it never runs in the middle of a deploy, rollback or restore.
# Cron sends the output to the server journal: journalctl -t crm-daily-backup
#
# Usage: daily-backup.sh
set -euo pipefail

cd "$(dirname "$0")"
source ./lib.sh
if [ "$env_name" != prod ]; then
  echo "Daily backups are made only on prod" >&2
  exit 1
fi
require_env
acquire_lock

if ! backup=$(bash ./backup.sh daily); then
  echo "Daily backup FAILED" >&2
  exit 1
fi
echo "Saved $backup"
