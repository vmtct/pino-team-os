#!/usr/bin/env bash
set -euo pipefail
sha="${1:?exact evaluator SHA required}"
repo="vmtct/pino-access-evaluator"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid evaluator SHA" >&2; exit 1; }
main_sha="$(gh api "/repos/${repo}/git/ref/heads/main" --jq '.object.sha')"
[ "$main_sha" = "$sha" ] || { echo "Evaluator SHA is not exact current main" >&2; exit 1; }
prs="$(gh api -H 'Accept: application/vnd.github+json' "/repos/${repo}/commits/${sha}/pulls")"
pr="$(jq -c --arg sha "$sha" '[.[] | select(.merged_at!=null and .base.ref=="main" and .merge_commit_sha==$sha)] | if length==1 then .[0] else empty end' <<<"$prs")"
[ -n "$pr" ] || { echo "Evaluator SHA lacks unique merged-PR provenance" >&2; exit 1; }
pr_number="$(jq -r '.number' <<<"$pr")"
pages="$(gh api --paginate --slurp "/repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&status=completed&per_page=100")"
latest="$(jq -c --arg sha "$sha" --arg repo "$repo" '[.[]?.workflow_runs[]? | select(.head_sha==$sha and .event=="push" and .head_branch=="main" and .repository.full_name==$repo)] | sort_by(.updated_at // .run_started_at // .created_at // "") | last // empty' <<<"$pages")"
[ -n "$latest" ] || { echo "Evaluator exact-main CI is missing" >&2; exit 1; }
[ "$(jq -r '.conclusion // ""' <<<"$latest")" = "success" ] || { echo "Latest evaluator exact-main CI is not successful" >&2; exit 1; }
ci_run="$(jq -r '.id' <<<"$latest")"
jq -nc --arg evaluatorSha "$sha" --argjson mergedPr "$pr_number" --argjson ciRun "$ci_run" '{evaluatorSha:$evaluatorSha,mergedPr:$mergedPr,ciRun:$ciRun}'