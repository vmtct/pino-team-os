#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY required}"
: "${ISSUE_NUMBER:?ISSUE_NUMBER required}"
: "${AUTH_BODY_HASH:?AUTH_BODY_HASH required}"
: "${TEAM_SHA:?TEAM_SHA required}"
: "${STAGING_VERSION_ID:?STAGING_VERSION_ID required}"
: "${STAGING_DEPLOY_RUN_ID:?STAGING_DEPLOY_RUN_ID required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID required}"

bash scripts/assert-live-issue-authority.sh "$GITHUB_REPOSITORY" "$ISSUE_NUMBER" "[GPT] Workforce exception staging E2E" "$AUTH_BODY_HASH"

current_main="$(gh api "/repos/${GITHUB_REPOSITORY}/git/ref/heads/main" --jq '.object.sha')"
[ "$current_main" = "$TEAM_SHA" ] || { echo "Team main drifted before Golden Journey mutation" >&2; exit 1; }

deployment="$(npx wrangler deployments status -c wrangler.staging.jsonc --json)"
prefix="Workforce staging ${TEAM_SHA} run "
message="$(jq -r '.annotations["workers/message"] // ""' <<<"$deployment")"
[ "$message" = "$prefix${STAGING_DEPLOY_RUN_ID}" ] || { echo "Current staging deployment provenance changed before Golden Journey mutation" >&2; exit 1; }
active_versions="$(jq -r '[.versions[]? | select(.percentage == 100) | .version_id] | length' <<<"$deployment")"
[ "$active_versions" -eq 1 ] || { echo "Current staging deployment does not have exactly one 100% active version" >&2; exit 1; }
jq -e --arg version "$STAGING_VERSION_ID" 'any(.versions[]?; .percentage == 100 and .version_id == $version)' <<<"$deployment" >/dev/null || { echo "Staging serving revision changed before Golden Journey mutation" >&2; exit 1; }
