#!/usr/bin/env bash
set -euo pipefail
issue="${1:?Evaluator secret issue}"; run_id="${2:?Evaluator secret run}"
repo="${GITHUB_REPOSITORY:-vmtct/pino-team-os}"
evaluator_repo="vmtct/pino-access-evaluator"; worker="pino-access-evaluator"
[ "$repo" = "vmtct/pino-team-os" ] || { echo "Unexpected repository" >&2; exit 1; }
run="$(gh api "/repos/${repo}/actions/runs/${run_id}")"
team_sha="$(jq -r '.head_sha // empty' <<<"$run")"
[[ "$team_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Evaluator provider run lacks Team SHA" >&2; exit 1; }
jq -e --arg sha "$team_sha" --arg issue "$issue" '.repository.full_name=="vmtct/pino-team-os" and .head_sha==$sha and .event=="issues" and .run_attempt==1 and .status=="completed" and .conclusion=="success" and .actor.login=="vmtct" and .triggering_actor.login=="vmtct" and .path==".github/workflows/access-sync-worker-secret.yml" and .display_title==("Access sync worker secret #"+$issue+" @ "+$sha)' <<<"$run" >/dev/null
issue_json="$(gh api "/repos/${repo}/issues/${issue}")"
jq -e '.state=="open" and .user.login=="vmtct" and .title=="[GPT] Access sync worker secret"' <<<"$issue_json" >/dev/null
comments="$(gh api --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
terminal="$(jq -c --arg run "$run_id" '[.[][] | select(.user.login=="github-actions[bot]" and ((.body // "")|startswith("ACCESS_SYNC_WORKER_SECRET: **PASS**")) and ((.body // "")|contains("Workflow run: " + $run)))] | sort_by(.created_at) | last // empty' <<<"$comments")"
[ -n "$terminal" ] || { echo "Evaluator provider run lacks exact PASS receipt" >&2; exit 1; }
body="$(jq -r '.body // "" | gsub("\\\\n"; "\n")' <<<"$terminal")"
team_source="$(sed -nE 's/^Team source:[[:space:]]*([0-9a-f]{40})[[:space:]]*$/\1/p' <<<"$body")"
evaluator_source="$(sed -nE 's/^Evaluator source:[[:space:]]*([0-9a-f]{40})[[:space:]]*$/\1/p' <<<"$body")"
version_tag="$(sed -nE 's/^Evaluator version tag:[[:space:]]*([^[:space:]]+)[[:space:]]*$/\1/p' <<<"$body")"
script_etag="$(sed -nE 's/^Evaluator script etag:[[:space:]]*([^[:space:]]+)[[:space:]]*$/\1/p' <<<"$body")"
version="$(sed -nE 's/^Evaluator version:[[:space:]]*([0-9a-f-]{36})[[:space:]]*$/\1/p' <<<"$body")"
deployment="$(sed -nE 's/^Evaluator deployment:[[:space:]]*([0-9a-f-]{36})[[:space:]]*$/\1/p' <<<"$body")"
marker="$(sed -nE 's/^Evaluator deployment marker:[[:space:]]*(PINO_ACCESS_SECRET:[^[:space:]]+)[[:space:]]*$/\1/p' <<<"$body")"
auth_hash="$(sed -nE 's/^Authorization body hash:[[:space:]]*([0-9a-f]{64})[[:space:]]*$/\1/p' <<<"$body")"
[ "$team_source" = "$team_sha" ] && [[ "$evaluator_source" =~ ^[0-9a-f]{40}$ ]] && [ -n "$version_tag" ] && [ -n "$script_etag" ] && [ -n "$version" ] && [ -n "$deployment" ] && [ -n "$marker" ] && [[ "$auth_hash" =~ ^[0-9a-f]{64}$ ]] || { echo "Evaluator provider receipt incomplete" >&2; exit 1; }
[[ "$marker" == "PINO_ACCESS_SECRET:${team_sha}:${evaluator_source}:${run_id}:1:"* ]] || { echo "Evaluator deployment marker does not bind Team/evaluator source and exact run" >&2; exit 1; }
live_body="$(jq -r '.body // ""' <<<"$issue_json")"
[ "$(printf '%s' "$live_body" | sha256sum | cut -d' ' -f1)" = "$auth_hash" ] || { echo "Evaluator provider authorization body changed after PASS" >&2; exit 1; }
runs="$(gh api --paginate --slurp "/repos/${repo}/actions/workflows/access-sync-worker-secret.yml/runs?event=issues&per_page=100")"
latest="$(jq -r --arg sha "$team_sha" '[.[]?.workflow_runs[]? | select(.head_sha==$sha and .event=="issues" and .actor.login=="vmtct" and ((.display_title // "")|startswith("Access sync worker secret #")) and ((.display_title // "")|endswith(" @ "+$sha))] | sort_by(.updated_at // .run_started_at // .created_at // "") | last | .id // empty' <<<"$runs")"
[ "$latest" = "$run_id" ] || { echo "Evaluator provider run superseded by newer same-SHA attempt" >&2; exit 1; }
evaluator_main="$(git ls-remote "https://github.com/${evaluator_repo}.git" refs/heads/main | awk '{print $1}')"
[ "$evaluator_main" = "$evaluator_source" ] || { echo "Evaluator source authority drifted from canonical main" >&2; exit 1; }
[ -n "${CF_ACCOUNT_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ] || { echo "Cloudflare Worker read authority unavailable" >&2; exit 1; }
version_detail="$(curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${worker}/versions/${version}" -H "Authorization: Bearer ${CF_API_TOKEN}")"
[ "$(jq -r '.result.resources.script.etag // empty' <<<"$version_detail")" = "$script_etag" ] || { echo "Evaluator immutable script etag drifted" >&2; exit 1; }
jq -e '[.result.resources.bindings[]? | select(.name=="CF_ACCESS_API_TOKEN" and .type=="secret_text")] | length==1' <<<"$version_detail" >/dev/null || { echo "Evaluator version lacks dedicated Access secret binding" >&2; exit 1; }
versions="$(CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" npx --yes wrangler@4.127.1 versions list --name "$worker" --json)"
[ "$(jq -r --arg id "$version" '.[] | select(.id==$id) | .annotations["workers/tag"] // empty' <<<"$versions")" = "$version_tag" ] || { echo "Evaluator immutable version tag drifted" >&2; exit 1; }
live="$(curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${worker}/deployments" -H "Authorization: Bearer ${CF_API_TOKEN}")"
[ "$(jq -r '.result.deployments[0].id // empty' <<<"$live")" = "$deployment" ] || { echo "Evaluator live deployment drifted" >&2; exit 1; }
[ "$(jq -r '.result.deployments[0].versions[]? | select(.percentage==100) | .version_id // empty' <<<"$live" | head -1)" = "$version" ] || { echo "Evaluator live version drifted" >&2; exit 1; }
[ "$(jq -r '.result.deployments[0].annotations["workers/message"] // empty' <<<"$live")" = "$marker" ] || { echo "Evaluator deployment marker drifted" >&2; exit 1; }
jq -nc --arg teamSha "$team_sha" --arg evaluatorSha "$evaluator_source" --arg scriptEtag "$script_etag" --arg versionTag "$version_tag" --arg version "$version" --arg deployment "$deployment" --arg marker "$marker" --arg issue "$issue" --arg run "$run_id" '{teamSha:$teamSha,evaluatorSha:$evaluatorSha,scriptEtag:$scriptEtag,versionTag:$versionTag,version:$version,deployment:$deployment,marker:$marker,issue:$issue,run:$run}'
