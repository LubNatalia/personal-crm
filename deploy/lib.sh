# shellcheck shell=bash
# Shared by the server-side scripts (deploy.sh, backup.sh, restore.sh):
# sourced from the deploy folder on the server, not run on its own.

compose=(docker compose -p prod -f compose.yml)
health_url=http://127.0.0.1:3000/health

require_env() {
  if [ ! -f .env ]; then
    echo "No .env in $PWD: create it first (see README)" >&2
    exit 1
  fi
  chmod 600 .env
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
