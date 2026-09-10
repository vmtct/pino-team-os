#!/usr/bin/env bash
set -euo pipefail
core_sha="${1:?core_sha}"; deployment_id="${2:?deployment_id}"; issue_number="${3:?issue}"; run_id="${4:?run}"
repo="vmtct/pino-core"; worker="pino-core"
core_token="${CORE_RELEASE_GH_TOKEN:?PINO_CORE_RELEASE_READ_TOKEN unavailable}"
core_api() { GH_TOKEN="$core_token" gh api "$@"; }
run="$(core_api "/repos/${repo}/actions/runs/${run_id}")"
jq -e --arg sha "$core_sha" '.repository.full_name=="vmtct/pino-core" and .path==".github/workflows/core-production-release.yml" and .event=="issues" and .head_sha==$sha and .run_attempt==1 and .status=="completed" and .conclusion=="success" and .actor.login=="vmtct" and .triggering_actor.login=="vmtct"' <<<"$run" >/dev/null
pages="$(core_api --paginate --slurp "/repos/${repo}/actions/workflows/core-production-release.yml/runs?event=issues&per_page=100")"
latest="$(jq -r --arg sha "$core_sha" '[.[]?.workflow_runs[]? | select(.head_sha==$sha and .event=="issues" and .actor.login=="vmtct" and ((.display_title // "") | startswith("Core production release #")) and ((.display_title // "") | endswith(" @ " + $sha)))] | sort_by(.updated_at // .run_started_at // .created_at // "") | last | .id // empty' <<<"$pages")"
[ "$latest" = "$run_id" ] || { echo "Selected Core production release is superseded by a newer same-SHA attempt" >&2; exit 1; }
issue="$(core_api "/repos/${repo}/issues/${issue_number}")"
jq -e '.user.login=="vmtct" and .title=="[GPT] Core production release"' <<<"$issue" >/dev/null
comments="$(core_api --paginate --slurp "/repos/${repo}/issues/${issue_number}/comments?per_page=100")"
terminal="$(jq -c '[.[][] | select(.user.login=="github-actions[bot]" and (((.body // "")|startswith("CORE_PRODUCTION_RELEASE: **PASS**")) or ((.body // "")|startswith("CORE_PRODUCTION_RELEASE: **FAIL_SAFE**")) or ((.body // "")|startswith("CORE_PRODUCTION_RELEASE: **REJECTED**"))))] | sort_by(.created_at) | last // empty' <<<"$comments")"
[ -n "$terminal" ]
jq -e --arg sha "$core_sha" --arg dep "$deployment_id" --arg run "$run_id" '.body | startswith("CORE_PRODUCTION_RELEASE: **PASS**") and contains("Core source: "+$sha) and contains("Deployment ID: "+$dep) and contains("Workflow run: "+$run) and contains("Workflow attempt: 1")' <<<"$terminal" >/dev/null
api="https://api.cloudflare.com/client/v4"; auth=(-H "Authorization: Bearer ${CF_API_TOKEN:?CF_API_TOKEN}" -H "Content-Type: application/json")
state="$(curl -fsS "${api}/accounts/${CF_ACCOUNT_ID:?CF_ACCOUNT_ID}/workers/scripts/${worker}/deployments" "${auth[@]}")"
[ "$(jq -r '.result.deployments[0].id // empty' <<<"$state")" = "$deployment_id" ]
