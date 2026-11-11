# shellcheck shell=bash
# Shared by the server-side scripts: sourced from the deploy folder on the
# server, not run on its own.
#
# The environment is the name of the folder the scripts live in: every
# environment has its own copy of deploy/ (/opt/crm/prod, /opt/crm/staging),
# with its own .env, current-image and lock. A script in the prod folder can
# only ever touch prod.

env_name=$(basename "$PWD")
case "$env_name" in
  prod) app_port=3000 ;;
  staging) app_port=3001 ;;
  *)
    echo "Unknown environment \"$env_name\": the deploy folder must be /opt/crm/prod or /opt/crm/staging" >&2
    exit 1
    ;;
esac
# compose.yml publishes the app on this port of 127.0.0.1
export APP_PORT="$app_port"

compose=(docker compose -p "$env_name" -f compose.yml)
health_url="http://127.0.0.1:$app_port/health"

require_env() {
  if [ ! -f .env ]; then
    echo "No .env in $PWD: create it first with init-env.sh (see README)" >&2
    exit 1
  fi
  chmod 600 .env
}

# One deploy, rollback or restore at a time per environment. The lock is held
# until the script exits; a second one waits up to 10 minutes, then gives up
acquire_lock() {
  exec 9>.deploy.lock
  if ! flock --timeout 600 9; then
    echo "Another deploy, rollback or restore of $env_name is still running: gave up waiting" >&2
    exit 1
  fi
}

# Waits up to a minute for /health to answer 200; on failure prints the app logs
smoke_test() {
  echo "==> Smoke test $health_url"
  local status=000
  for _ in $(seq 30); do
    status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$health_url" || true)
    if [ "$status" = 200 ]; then
      echo "Smoke test passed: $health_url answered 200"
      return 0
    fi
    sleep 2
  done
  echo "Smoke test FAILED: $health_url answered $status." >&2
  "${compose[@]}" logs --tail 50 app >&2
  return 1
}

# Backups live in backups/ of the prod folder, named
# <date>_<version>_<kind>.dump. Every kind keeps its own 7 newest files:
#   deploy          taken by deploy.sh before a deploy or rollback
#   daily           taken by daily-backup.sh at 03:00 Moscow time
#   manual          backup.sh run by hand
#   before-restore  taken by restore.sh before it replaces the database
# Files from before the kinds existed (no kind in the name) count as manual.
backup_kinds="deploy daily manual before-restore"
backups_to_keep=7

backup_kind() {
  local name suffix
  name=$(basename "$1" .dump)
  suffix="${name##*_}"
  case " $backup_kinds " in
    *" $suffix "*) echo "$suffix" ;;
    *) echo manual ;;
  esac
}

# Removes all but the newest backups of one kind. The names start with the
# date, so they sort by time
prune_backups() {
  local kind="$1" file
  for file in backups/*.dump; do
    if [ -e "$file" ] && [ "$(backup_kind "$file")" = "$kind" ]; then
      echo "$file"
    fi
  done | sort --reverse | tail -n +$((backups_to_keep + 1)) | xargs --no-run-if-empty rm --
}
