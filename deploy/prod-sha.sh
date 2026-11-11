#!/usr/bin/env bash
# Runs in GitHub Actions (Deploy prod): prints the full commit SHA to deploy to
# prod. Only a SHA that passed staging may go there: the script looks it up in
# the green runs of the "Deploy staging" workflow on main.
#   no argument: the SHA of the last green staging deploy
#   a SHA (full, or at least its first 7 characters): that SHA, if it passed
#   staging; otherwise the script stops with an error
# Needs GH_TOKEN with read access to Actions, and GITHUB_REPOSITORY.
#
# Usage: prod-sha.sh [sha]
set -euo pipefail

wanted=$(printf '%s' "${1:-}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
: "${GITHUB_REPOSITORY:?}"

# Newest first
green=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow deploy-staging.yml \
  --branch main --status success --limit 300 --json headSha --jq '.[].headSha')
if [ -z "$green" ]; then
  echo "No green staging deploy found: merge into main and wait for Deploy staging to pass" >&2
  exit 1
fi

if [ -z "$wanted" ]; then
  sha=$(head -n 1 <<<"$green")
  echo "The last green staging deploy: $sha" >&2
  echo "$sha"
  exit 0
fi

if ! [[ "$wanted" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "\"$wanted\" is not a commit SHA: use 7 to 40 characters 0-9, a-f" >&2
  exit 1
fi
matches=$(grep "^$wanted" <<<"$green" | sort --unique || true)
case "$(grep --count . <<<"$matches" || true)" in
  0)
    echo "$wanted has not passed staging (no green Deploy staging run on main for it): it can't go to prod" >&2
    exit 1
    ;;
  1)
    echo "$matches passed staging" >&2
    echo "$matches"
    ;;
  *)
    echo "$wanted matches several commits, give more characters:" >&2
    echo "$matches" >&2
    exit 1
    ;;
esac
