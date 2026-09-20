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
: "${CORE_REPOSITORY:?CORE_REPOSITORY required}"
: "${CORE_SHA:?CORE_SHA required}"
: "${CORE_STAGING_WORKER:?CORE_STAGING_WORKER required}"
: "${CORE_STAGING_DEPLOYMENT_ID:?CORE_STAGING_DEPLOYMENT_ID required}"
: "${CORE_STAGING_VERSION_ID:?CORE_STAGING_VERSION_ID required}"
: "${CORE_STAGING_DEPLOYMENT_MARKER:?CORE_STAGING_DEPLOYMENT_MARKER required}"
: "${CORE_STAGING_DEPLOY_RUN_ID:?CORE_STAGING_DEPLOY_RUN_ID required}"
: "${CORE_STAGING_DEPLOY_RUN_ATTEMPT:?CORE_STAGING_DEPLOY_RUN_ATTEMPT required}"

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

core_state="$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${CORE_STAGING_WORKER}/deployments")"
jq -e '.success == true' <<<"$core_state" >/dev/null || { echo "Cannot resolve Core staging deployment state" >&2; exit 1; }
core_deployment_id="$(jq -r '.result.deployments[0].id // empty' <<<"$core_state")"
core_marker="$(jq -r '.result.deployments[0].annotations["workers/message"] // empty' <<<"$core_state")"
core_active_versions="$(jq -r '[.result.deployments[0].versions[]? | select(.percentage == 100) | .version_id] | length' <<<"$core_state")"
[ "$core_active_versions" -eq 1 ] || { echo "Core staging deployment does not have exactly one 100% active version" >&2; exit 1; }
core_version_id="$(jq -r '.result.deployments[0].versions[]? | select(.percentage == 100) | .version_id // empty' <<<"$core_state")"
[ "$core_deployment_id" = "$CORE_STAGING_DEPLOYMENT_ID" ] || { echo "Core staging deployment changed before Golden Journey mutation" >&2; exit 1; }
[ "$core_version_id" = "$CORE_STAGING_VERSION_ID" ] || { echo "Core staging active version changed before Golden Journey mutation" >&2; exit 1; }
[ "$core_marker" = "$CORE_STAGING_DEPLOYMENT_MARKER" ] || { echo "Core staging deployment marker changed before Golden Journey mutation" >&2; exit 1; }
if [[ ! "$CORE_STAGING_DEPLOYMENT_MARKER" =~ ^PINO_STAGING_RUNTIME_EVIDENCE:([0-9a-f]{40}):([0-9]+):([1-9][0-9]*):([0-9a-f-]{36})$ ]]; then
  echo "Core staging marker is not canonical runtime evidence" >&2
  exit 1
fi
[ "${BASH_REMATCH[1]}" = "$CORE_SHA" ] || { echo "Core staging marker SHA does not match CORE_SHA" >&2; exit 1; }
[ "${BASH_REMATCH[2]}" = "$CORE_STAGING_DEPLOY_RUN_ID" ] || { echo "Core staging marker run id drifted" >&2; exit 1; }
[ "${BASH_REMATCH[3]}" = "$CORE_STAGING_DEPLOY_RUN_ATTEMPT" ] || { echo "Core staging marker run attempt drifted" >&2; exit 1; }
core_run="$(gh api "/repos/${CORE_REPOSITORY}/actions/runs/${CORE_STAGING_DEPLOY_RUN_ID}")"
jq -e --arg sha "$CORE_SHA" --argjson attempt "$CORE_STAGING_DEPLOY_RUN_ATTEMPT" '.head_sha == $sha and .event == "issues" and .status == "completed" and .conclusion == "success" and .actor.login == "vmtct" and .triggering_actor.login == "vmtct" and .path == ".github/workflows/open-studio-core-staging-deploy.yml" and .run_attempt == $attempt' <<<"$core_run" >/dev/null || { echo "Core staging run provenance changed before Golden Journey mutation" >&2; exit 1; }
