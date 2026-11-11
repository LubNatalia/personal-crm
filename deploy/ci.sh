#!/usr/bin/env bash
# Runs in GitHub Actions: copies the server-side deploy files into the folder
# of the environment on the server and runs deploy.sh there. The folder is the
# environment: the scripts in /opt/crm/staging work only on staging.
# Settings come from the workflow environment.
#
# Usage: ci.sh <prod|staging> <image>
set -euo pipefail

env_name="${1:?Usage: ci.sh <prod|staging> <image>}"
image="${2:?Usage: ci.sh <prod|staging> <image>}"
case "$env_name" in
  prod | staging) ;;
  *)
    echo "Unknown environment \"$env_name\": use prod or staging" >&2
    exit 1
    ;;
esac
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_SSH_KEY:?}"
: "${GHCR_USER:?}" "${GHCR_TOKEN:?}"
remote_dir="/opt/crm/$env_name"

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
  # A slow image pull prints nothing for minutes; keep the connection from
  # being dropped as idle on the way
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=6
)
target="$DEPLOY_USER@$DEPLOY_HOST"

cd "$(dirname "$0")"
ssh "${ssh_opts[@]}" "$target" "mkdir -p '$remote_dir'"
# The whole deploy folder: a new script gets to the server without changes here
scp "${ssh_opts[@]}" ./* "$target:$remote_dir/"
# The registry token goes through stdin, so it never appears in a command line
printf '%s\n' "$GHCR_TOKEN" \
  | ssh "${ssh_opts[@]}" "$target" "bash $remote_dir/deploy.sh '$image' '$GHCR_USER'"
