#!/usr/bin/env bash
set -euo pipefail
issue="${1:?Evaluator secret issue}"; run_id="${2:?Evaluator secret run}"
repo="${GITHUB_REPOSITORY:-vmtct/pino-team-os}"
[ "$repo" = "vmtct/pino-team-os" ] || { echo "Unexpected repository" >&2; exit 1; }
run="$(gh api "/repos/${repo}/actions/runs/${run_id}")"
sha="$(jq -r '.head_sha // empty' <<<"$run")"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Evaluator provider run lacks Team SHA" >&2; exit 1; }
jq -e --arg sha "$sha" --arg issue "$issue" '.repository.full_name=="vmtct/pino-team-os" and .head_sha==$sha and .event=="issues" and .run_attempt==1 and .status=="completed" and .conclusion=="success" and .actor.login=="vmtct" and .triggering_actor.login=="vmtct" and .path==".github/workflows/access-sync-worker-secret.yml" and .display_title==("Access sync worker secret #"+$issue+" @ "+$sha)' <<<"$run" >/dev/null
issue_json="$(gh api "/repos/${repo}/issues/${issue}")"
jq -e '.state=="open" and .user.login=="vmtct" and .title=="[GPT] Access sync worker secret"' <<<"$issue_json" >/dev/null
comments="$(gh api --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
terminal="$(jq -c --arg run "$run_id" '[.[][] | select(.user.login=="github-actions[bot]" and ((.body // "")|startswith("ACCESS_SYNC_WORKER_SECRET: **PASS**")) and ((.body // "")|contains("Workflow run: " + $run)))] | sort_by(.created_at) | last // empty' <<<"$comments")"
[ -n "$terminal" ] || { echo "Evaluator provider run lacks exact PASS receipt" >&2; exit 1; }
body="$(jq -r '.body // ""' <<<"$terminal")"
source="$(sed -nE 's/^Team source:[[:space:]]*([0-9a-f]{40})[[:space:]]*$/\1/p' <<<"$body")"
version="$(sed -nE 's/^Evaluator version:[[:space:]]*([0-9a-f-]{36})[[:space:]]*$/\1/p' <<<"$body")"
deployment="$(sed -nE 's/^Evaluator deployment:[[:space:]]*([0-9a-f-]{36})[[:space:]]*$/\1/p' <<<"$body")"
marker="$(sed -nE 's/^Evaluator deployment marker:[[:space:]]*(PINO_ACCESS_SECRET:[^[:space:]]+)[[:space:]]*$/\1/p' <<<"$body")"
auth_hash="$(sed -nE 's/^Authorization body hash:[[:space:]]*([0-9a-f]{64})[[:space:]]*$/\1/p' <<<"$body")"
[ "$source" = "$sha" ] && [ -n "$version" ] && [ -n "$deployment" ] && [ -n "$marker" ] && [[ "$auth_hash" =~ ^[0-9a-f]{64}$ ]] || { echo "Evaluator provider receipt incomplete" >&2; exit 1; }
live_body="$(jq -r '.body // ""' <<<"$issue_json")"
[ "$(printf '%s' "$live_body" | sha256sum | cut -d' ' -f1)" = "$auth_hash" ] || { echo "Evaluator provider authorization body changed after PASS" >&2; exit 1; }
runs="$(gh api --paginate --slurp "/repos/${repo}/actions/workflows/access-sync-worker-secret.yml/runs?event=issues&per_page=100")"
latest="$(jq -r --arg sha "$sha" '[.[]?.workflow_runs[]? | select(.head_sha==$sha and .event=="issues" and .actor.login=="vmtct" and ((.display_title // "")|startswith("Access sync worker secret #")) and ((.display_title // "")|endswith(" @ "+$sha))] | sort_by(.updated_at // .run_started_at // .created_at // "") | last | .id // empty' <<<"$runs")"
[ "$latest" = "$run_id" ] || { echo "Evaluator provider run superseded by newer same-SHA attempt" >&2; exit 1; }
[ -n "${CF_ACCOUNT_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ] || { echo "Cloudflare Worker read authority unavailable" >&2; exit 1; }
live="$(curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/pino-access-evaluator/deployments" -H "Authorization: Bearer ${CF_API_TOKEN}")"
[ "$(jq -r '.result.deployments[0].id // empty' <<<"$live")" = "$deployment" ] || { echo "Evaluator live deployment drifted" >&2; exit 1; }
[ "$(jq -r '.result.deployments[0].versions[]? | select(.percentage==100) | .version_id // empty' <<<"$live" | head -1)" = "$version" ] || { echo "Evaluator live version drifted" >&2; exit 1; }
[ "$(jq -r '.result.deployments[0].annotations["workers/message"] // empty' <<<"$live")" = "$marker" ] || { echo "Evaluator deployment marker drifted" >&2; exit 1; }
jq -nc --arg sha "$sha" --arg version "$version" --arg deployment "$deployment" --arg marker "$marker" --arg issue "$issue" --arg run "$run_id" '{sha:$sha,version:$version,deployment:$deployment,marker:$marker,issue:$issue,run:$run}'
