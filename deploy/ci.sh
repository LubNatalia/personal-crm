#!/usr/bin/env bash
# Runs in GitHub Actions: copies the server-side deploy files to the server
# and runs deploy.sh there. Settings come from the workflow environment.
#
# Usage: ci.sh <image>
set -euo pipefail

image="${1:?Usage: ci.sh <image>}"
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_SSH_KEY:?}"
: "${GHCR_USER:?}" "${GHCR_TOKEN:?}"
remote_dir=/opt/crm/prod

ssh_dir=$(mktemp -d)
trap 'rm -rf "$ssh_dir"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key"
chmod 600 "$ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
ssh_opts=(
  -i "$ssh_dir/key"
  -o IdentitiesOnly=yes
  -o UserKnownHostsFile="$ssh_dir/known_hosts"
  -o StrictHostKeyChecking=yes
  -o BatchMode=yes
)
target="$DEPLOY_USER@$DEPLOY_HOST"

cd "$(dirname "$0")"
scp "${ssh_opts[@]}" compose.yml deploy.sh rollback.sh "$target:$remote_dir/"
# The registry token goes through stdin, so it never appears in a command line
printf '%s\n' "$GHCR_TOKEN" \
  | ssh "${ssh_opts[@]}" "$target" "bash $remote_dir/deploy.sh '$image' '$GHCR_USER'"
