#!/usr/bin/env bash
# Runs in GitHub Actions: copies the server-side deploy files into the folder
# of the environment on the server and runs deploy.sh there (or rollback.sh,
# with --rollback). The folder is the environment: the scripts in
# /opt/crm/staging work only on staging. Settings come from the workflow
# environment. At the end it writes into the run summary which version the
# environment runs now.
#
# Usage: ci.sh <prod|staging> <image>
#        ci.sh <prod|staging> --rollback
set -euo pipefail

usage="Usage: ci.sh <prod|staging> <image|--rollback>"
env_name="${1:?$usage}"
target_image="${2:?$usage}"
case "$env_name" in
  prod | staging) ;;
  *)
    echo "Unknown environment \"$env_name\": use prod or staging" >&2
    exit 1
    ;;
esac
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_SSH_KEY:?}"
if [ "$target_image" != --rollback ]; then
  : "${GHCR_USER:?}" "${GHCR_TOKEN:?}"
fi
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

status=0
if [ "$target_image" = --rollback ]; then
  # The previous version is remembered by the server (previous-image) and its
  # image is kept there, so nothing is pulled
  ssh "${ssh_opts[@]}" "$target" "bash $remote_dir/rollback.sh" </dev/null || status=$?
else
  # The registry token goes through stdin, so it never appears in a command line
  printf '%s\n' "$GHCR_TOKEN" \
    | ssh "${ssh_opts[@]}" "$target" "bash $remote_dir/deploy.sh '$target_image' '$GHCR_USER'" \
    || status=$?
fi

running=$(ssh "${ssh_opts[@]}" "$target" "cat '$remote_dir/current-image' 2>/dev/null" </dev/null || true)
version="${running##*:}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    if [ "$target_image" = --rollback ]; then
      echo "### Rollback of $env_name"
    else
      echo "### Deploy to $env_name"
    fi
    if [ "$status" = 0 ]; then
      echo "Done. $env_name runs version \`${version:-unknown}\`"
    else
      echo "FAILED (see the log of this step). $env_name now runs version \`${version:-unknown}\`. Nothing was rolled back."
    fi
  } >>"$GITHUB_STEP_SUMMARY"
fi
echo "$env_name runs ${running:-an unknown image}"
exit "$status"
