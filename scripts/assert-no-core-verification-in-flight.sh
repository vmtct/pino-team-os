#!/usr/bin/env bash
set -euo pipefail
repo=vmtct/pino-core; core_token="${CORE_RELEASE_GH_TOKEN:?PINO_CORE_RELEASE_READ_TOKEN unavailable}"
gh_core() {
 local result
 if result="$(GH_TOKEN="$core_token" gh api "$@" 2>&1)"; then
  printf '%s\n' "$result"
 else
  case "$result" in
   *"rate limit"*|*"HTTP 403"*) echo "CORE_GITHUB_API_RATE_LIMIT_OR_FORBIDDEN: $result" >&2 ;;
   *"HTTP 500"*|*"HTTP 502"*|*"HTTP 503"*|*"HTTP 504"*) echo "CORE_GITHUB_API_UNAVAILABLE: $result" >&2 ;;
   *) echo "CORE_GITHUB_API_READ_FAILURE: $result" >&2 ;;
  esac
  return 2
 fi
}
# The 2026-10-21 05:47:32Z Team evaluator #694 / run 39549944942
# succeeded after the old exhaustive Core recovery guard. This immutable
# attestation seals all Core terminal history through its run start. Preserve
# ongoing Core workflow overlap checks above and exhaustively scan all risky
# terminal conclusions CREATED since 05:00Z (a conservative half-hour overlap).
# This is an attested historical checkpoint, NOT an unchecked time-window skip.
baseline_run="$(gh api /repos/vmtct/pino-team-os/actions/runs/39549944942 2>&1)" || {
 echo "CORE_RECOVERY_BASELINE_PROVIDER_READ_FAILURE: $baseline_run" >&2; exit 2;
}
jq -e '.status=="completed" and .conclusion=="success" and .head_sha=="f0d8958b3b5fc6b709738193c12bfc4554e2431c"' <<<"$baseline_run" >/dev/null || {
 echo "CORE_RECOVERY_BASELINE_INVALID: historical verification run is not immutable successful authority" >&2; exit 1;
}
baseline_comments="$(gh api '/repos/vmtct/pino-team-os/issues/694/comments?per_page=100' 2>&1)" || {
 echo "CORE_RECOVERY_BASELINE_PROVIDER_READ_FAILURE: $baseline_comments" >&2; exit 2;
}
jq -e 'any(.[]; .user.login=="github-actions[bot]" and ((.body//"")|startswith("ACCESS_SYNC_WORKER_SECRET: **PASS**") and contains("Workflow run: 39549944942") and contains("Team source: f0d8958b3b5fc6b709738193c12bfc4554e2431c")))' <<<"$baseline_comments" >/dev/null || {
 echo "CORE_RECOVERY_BASELINE_INVALID: missing bot-authenticated full-history verification PASS" >&2; exit 1;
}
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
 for terminal_conclusion in failure cancelled timed_out action_required neutral stale startup_failure; do
  runs="$(gh_core --paginate --slurp "/repos/${repo}/actions/workflows/${workflow}/runs?event=issues&status=${terminal_conclusion}&created=>=2026-10-21T05:00:00Z&per_page=100")"
 while IFS=$'\t' read -r run_id run_attempt conclusion display; do
  [ -n "$run_id" ] || continue
  # Completed skipped workflows never entered a job and cannot have armed a
  # production mutation. Scanning their issues consumes thousands of GitHub
  # API reads (Core has >1000 historic no-op issue events); retain strict
  # recovery checks for every failed, cancelled, or otherwise uncertain run.
  case "$conclusion" in success|skipped) continue ;; esac
  issue="$(sed -nE "s/^${display_prefix//\#/\\#}([1-9][0-9]*) @ [0-9a-f]{40}$/\\1/p" <<<"$display")"; [ -n "$issue" ] || continue
  comments="$(gh_core --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
  marker="$(jq -c --arg p "$marker_prefix" --arg run "$run_id" --arg attempt "$run_attempt" '[.[][]|select(.user.login=="github-actions[bot]")|select(((.body//"")|startswith($p+": **RECOVERY_ARMED**")) and ((.body//"")|contains("Workflow run: "+$run)) and (((.body//"")|contains("Workflow attempt: "+$attempt)) or ($attempt=="1" and (((.body//"")|contains("Workflow attempt:"))|not))))]|last//empty' <<<"$comments")"; [ -n "$marker" ] || continue
  resolved="$(jq -r --arg p "$terminal_prefix" --arg run "$run_id" --arg attempt "$run_attempt" '[.[][]|select(.user.login=="github-actions[bot]")|(.body//"")|select(contains("Workflow run: "+$run) or contains("Verifier run: "+$run))|select(contains("Workflow attempt: "+$attempt) or ($attempt=="1" and (contains("Workflow attempt:")|not)))|select(startswith($p+": **WATCHDOG_RECOVERED**") or startswith($p+": **WATCHDOG_RECOVERY_CONFIRMED**") or startswith($p+": **RECOVERY_RESOLVED**") or (startswith($p+": **HOLD**") and contains("Time Travel rollback: PASS")) or (startswith($p+": **FAIL_SAFE**") and (contains("version was restored") or contains("baseline remained active"))))]|length' <<<"$comments")"
  [ "$resolved" -gt 0 ] || { echo "Completed Core run retains unresolved recovery: ${workflow} ${run_id}/${run_attempt}" >&2; exit 1; }
  done < <(jq -r --arg prefix "$display_prefix" '.[]?.workflow_runs[]?|select((.display_title//"")|startswith($prefix))|[.id,(.run_attempt//1),(.conclusion//""),(.display_title//"")]|@tsv' <<<"$runs")
 done
done
