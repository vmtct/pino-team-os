#!/usr/bin/env bash
set -euo pipefail
repo=vmtct/pino-core; core_token="${CORE_RELEASE_GH_TOKEN:?PINO_CORE_RELEASE_READ_TOKEN unavailable}"
gh_core(){ GH_TOKEN="$core_token" gh api "$@"; }
workflows=(core-production-release.yml production-release-recovery-watchdog.yml pre-ga-production-reset.yml pre-ga-production-local-auth-verification.yml pre-ga-recovery-watchdog.yml)
for workflow in "${workflows[@]}"; do
 for status in queued in_progress; do
  runs="$(gh_core "/repos/${repo}/actions/workflows/${workflow}/runs?status=${status}&per_page=100")"
  jq -e '[.workflow_runs[]?] | length==0' <<<"$runs" >/dev/null || { echo "Core production mutation/recovery workflow ${workflow} is ${status}" >&2; exit 1; }
 done
done
specs=('core-production-release.yml|Core production release #|PINO_CORE_PRODUCTION_RELEASE|CORE_PRODUCTION_RELEASE' 'pre-ga-production-reset.yml|PRE_GA production reset #|PRE_GA_PRODUCTION_RESET|PRE_GA_PRODUCTION_RESET' 'pre-ga-production-local-auth-verification.yml|PRE_GA production local-auth verification #|PRE_GA_PRODUCTION_LOCAL_AUTH_VERIFICATION|PRE_GA_PRODUCTION_LOCAL_AUTH_VERIFICATION')
for spec in "${specs[@]}"; do
 IFS='|' read -r workflow display_prefix marker_prefix terminal_prefix <<<"$spec"
 runs="$(GH_TOKEN="$core_token" gh api --paginate --slurp "/repos/${repo}/actions/workflows/${workflow}/runs?event=issues&status=completed&per_page=100")"
 while IFS=$'\t' read -r run_id run_attempt conclusion display; do
  [ -n "$run_id" ] || continue; [ "$conclusion" != "success" ] || continue
  issue="$(sed -nE "s/^${display_prefix//\#/\\#}([1-9][0-9]*) @ [0-9a-f]{40}$/\\1/p" <<<"$display")"; [ -n "$issue" ] || continue
  comments="$(GH_TOKEN="$core_token" gh api --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
  marker="$(jq -c --arg p "$marker_prefix" --arg run "$run_id" --arg attempt "$run_attempt" '[.[][]|select(.user.login=="github-actions[bot]")|select(((.body//"")|startswith($p+": **RECOVERY_ARMED**")) and ((.body//"")|contains("Workflow run: "+$run)) and (((.body//"")|contains("Workflow attempt: "+$attempt)) or ($attempt=="1" and (((.body//"")|contains("Workflow attempt:"))|not))))]|last//empty' <<<"$comments")"; [ -n "$marker" ] || continue
  resolved="$(jq -r --arg p "$terminal_prefix" --arg run "$run_id" --arg attempt "$run_attempt" '[.[][]|select(.user.login=="github-actions[bot]")|(.body//"")|select(contains("Workflow run: "+$run) or contains("Verifier run: "+$run))|select(contains("Workflow attempt: "+$attempt) or ($attempt=="1" and (contains("Workflow attempt:")|not)))|select(startswith($p+": **WATCHDOG_RECOVERED**") or startswith($p+": **WATCHDOG_RECOVERY_CONFIRMED**") or startswith($p+": **RECOVERY_RESOLVED**") or (startswith($p+": **HOLD**") and contains("Time Travel rollback: PASS")) or (startswith($p+": **FAIL_SAFE**") and (contains("version was restored") or contains("baseline remained active"))))]|length' <<<"$comments")"
  [ "$resolved" -gt 0 ] || { echo "Completed Core run retains unresolved recovery: ${workflow} ${run_id}/${run_attempt}" >&2; exit 1; }
 done < <(jq -r --arg prefix "$display_prefix" '.[]?.workflow_runs[]?|select((.display_title//"")|startswith($prefix))|[.id,(.run_attempt//1),(.conclusion//""),(.display_title//"")]|@tsv' <<<"$runs")
done
