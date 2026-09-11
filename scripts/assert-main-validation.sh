#!/usr/bin/env bash
set -euo pipefail
repo="${1:-${GITHUB_REPOSITORY:-vmtct/pino-team-os}}"
sha="${2:?exact Team SHA required}"
[ "$repo" = "vmtct/pino-team-os" ] || { echo "Unexpected Team repository: $repo" >&2; exit 1; }
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid Team SHA: $sha" >&2; exit 1; }
pages="$(gh api --paginate --slurp "/repos/${repo}/actions/workflows/pr-validation.yml/runs?head_sha=${sha}&status=completed&per_page=100")"
latest="$(jq -c --arg sha "$sha" '[.[]?.workflow_runs[]? | select(.head_sha==$sha and .event=="push" and .head_branch=="main")] | sort_by(.updated_at // .run_started_at // .created_at // "") | last // empty' <<<"$pages")"
[ -n "$latest" ] || { echo "No completed exact-main validation exists for ${sha}." >&2; exit 1; }
[ "$(jq -r '.conclusion // ""' <<<"$latest")" = "success" ] || { echo "Latest effective exact-main validation for ${sha} is not successful." >&2; exit 1; }
