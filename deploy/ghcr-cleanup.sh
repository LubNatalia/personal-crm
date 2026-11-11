#!/usr/bin/env bash
# Runs in GitHub Actions after a good prod deploy: keeps the 10 newest app
# image builds in GHCR (GitHub Container Registry) and deletes the older ones.
# A build is one tagged package version (the tag is the commit SHA). A build
# may also have untagged versions of its own (the image and its attestation
# under one index): those of the kept builds are kept, so no kept image breaks.
# Untagged versions newer than the oldest kept build are never deleted either:
# they may belong to a build that is being pushed right now.
# Needs GH_TOKEN with packages: write, GITHUB_REPOSITORY, and docker logged in
# to ghcr.io (to read the image indexes).
#
# Usage: ghcr-cleanup.sh
set -euo pipefail

builds_to_keep=10
: "${GITHUB_REPOSITORY:?}"
owner="${GITHUB_REPOSITORY%%/*}"
package=$(tr '[:upper:]' '[:lower:]' <<<"${GITHUB_REPOSITORY#*/}")
image="ghcr.io/$(tr '[:upper:]' '[:lower:]' <<<"$GITHUB_REPOSITORY")"

if [ "$(gh api "/users/$owner" --jq .type)" = Organization ]; then
  base="/orgs/$owner/packages/container/$package"
else
  base="/users/$owner/packages/container/$package"
fi

# id <tab> created_at <tab> digest <tab> tags
versions=$(gh api --paginate "$base/versions?per_page=100" \
  --jq '.[] | [.id, .created_at, .name, (.metadata.container.tags | join(","))] | @tsv')
kept_builds=$(awk -F '\t' '$4 != ""' <<<"$versions" | sort -t $'\t' -k 2,2 --reverse | head -n "$builds_to_keep")
if [ -z "$kept_builds" ]; then
  echo "No tagged images in GHCR: nothing to clean"
  exit 0
fi
oldest_kept=$(tail -n 1 <<<"$kept_builds" | cut -f 2)

# The digests that must stay: the kept builds and everything their index lists
keep_digests=$(cut -f 3 <<<"$kept_builds")
while IFS=$'\t' read -r _ _ digest tags; do
  children=$(docker buildx imagetools inspect --raw "$image@$digest" </dev/null | jq -r '.manifests[]?.digest')
  keep_digests+=$'\n'"$children"
  echo "Keeping ${tags%%,*}"
done <<<"$kept_builds"

deleted=0
while IFS=$'\t' read -r id created digest tags; do
  if grep --quiet --line-regexp --fixed-strings "$digest" <<<"$keep_digests"; then
    continue
  fi
  # Untagged and newer than the oldest kept build: may be a build in progress
  if [ -z "$tags" ] && [[ ! "$created" < "$oldest_kept" ]]; then
    continue
  fi
  gh api --method DELETE "$base/versions/$id" --silent </dev/null
  echo "Deleted ${tags:-untagged $digest} ($created)"
  deleted=$((deleted + 1))
done <<<"$versions"
echo "Deleted $deleted old versions from GHCR"
