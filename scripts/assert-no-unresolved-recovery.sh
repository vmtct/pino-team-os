#!/usr/bin/env bash
set -euo pipefail
repo="${GITHUB_REPOSITORY:-vmtct/pino-team-os}"
[ "$repo" = "vmtct/pino-team-os" ] || { echo "Unexpected repository: $repo" >&2; exit 1; }
specs=(
  'team-runtime-production-release.yml|Team runtime production release #|PINO_TEAM_PRODUCTION_RELEASE|TEAM_RUNTIME_PRODUCTION_RELEASE'
  'access-sync-worker-secret.yml|Access sync worker secret #|ACCESS_SYNC_WORKER_SECRET|ACCESS_SYNC_WORKER_SECRET'
  'bo-manager-access-reconcile.yml|BO manager Access reconcile #|BO_MANAGER_ACCESS_RECONCILE|BO_MANAGER_ACCESS_RECONCILE'
  'tos-google-idp-reconcile.yml|TOS Google IdP reconcile #|TOS_GOOGLE_IDP_RECONCILE|TOS_GOOGLE_IDP_RECONCILE'
  'tos-canonical-external-eval.yml|TOS canonical external evaluation #|TOS_CANONICAL_EXTERNAL_EVAL|TOS_CANONICAL_EXTERNAL_EVAL'
)
for spec in "${specs[@]}"; do
  IFS='|' read -r workflow display_prefix marker_prefix terminal_prefix <<<"$spec"
  runs="$(gh api "/repos/${repo}/actions/workflows/${workflow}/runs?event=issues&status=completed&per_page=30")"
  while IFS=$'\t' read -r run_id conclusion display; do
    [ -n "$run_id" ] || continue
    [ "$conclusion" != "success" ] || continue
    issue="$(sed -nE "s/^${display_prefix//\#/\\#}([1-9][0-9]*) @ [0-9a-f]{40}$/\\1/p" <<<"$display")"
    [ -n "$issue" ] || continue
    comments="$(gh api --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
    marker="$(jq -c --arg p "$marker_prefix" --arg run "$run_id" '[.[][] | select(.user.login=="github-actions[bot]" and ((.body // "")|startswith($p + ": **RECOVERY_ARMED**")) and ((.body // "")|contains("Workflow run: " + $run)))] | last // empty' <<<"$comments")"
    [ -n "$marker" ] || continue
    resolved="$(jq -r --arg p "$terminal_prefix" --arg run "$run_id" '[.[][] | select(.user.login=="github-actions[bot]") | (.body // "") | select(contains("Workflow run: " + $run)) | select(startswith($p + ": **PASS") or startswith($p + ": **WATCHDOG_RECOVERED**") or startswith($p + ": **WATCHDOG_RECOVERY_CONFIRMED**") or (startswith($p + ": **FAIL_SAFE**") and (contains("version was restored") or contains("baseline remained active"))))] | length' <<<"$comments")"
    [ "$resolved" -gt 0 ] || { echo "Unresolved Team recovery blocks production mutation: ${workflow} run ${run_id} issue #${issue}" >&2; exit 1; }
  done < <(jq -r --arg prefix "$display_prefix" '.workflow_runs[]? | select((.display_title // "") | startswith($prefix)) | [.id, (.conclusion // ""), (.display_title // "")] | @tsv' <<<"$runs")
done
