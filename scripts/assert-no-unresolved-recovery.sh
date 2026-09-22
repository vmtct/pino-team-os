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
  'team-access-perimeter-retire.yml|Team Access perimeter retirement #|TEAM_ACCESS_PERIMETER_RETIRE|TEAM_ACCESS_PERIMETER_RETIRE'
)
for spec in "${specs[@]}"; do
  IFS='|' read -r workflow display_prefix marker_prefix terminal_prefix <<<"$spec"
  runs="$(gh api --paginate --slurp "/repos/${repo}/actions/workflows/${workflow}/runs?event=issues&status=completed&per_page=100")"
  while IFS=$'\t' read -r run_id run_attempt conclusion display; do
    [ -n "$run_id" ] || continue
    if [ "$conclusion" = "success" ] && [ "$run_attempt" = "1" ]; then
      continue
    fi
    issue="$(sed -nE "s/^${display_prefix//\#/\\#}([1-9][0-9]*) @ [0-9a-f]{40}$/\\1/p" <<<"$display")"
    [ -n "$issue" ] || continue
    comments="$(gh api --paginate --slurp "/repos/${repo}/issues/${issue}/comments?per_page=100")"
    armed_attempts="$(jq -r --arg p "$marker_prefix" --arg run "$run_id" '
      [.[][]
        | select(.user.login=="github-actions[bot]")
        | ((.body // "") | gsub("\\\\n"; "\n")) as $b
        | select($b | startswith($p + ": **RECOVERY_ARMED**"))
        | select($b | test("(^|\\n)-?[[:space:]]*Workflow run:[[:space:]]*" + $run + "[[:space:]]*($|\\n)"))
        | if ($b | test("(^|\\n)Workflow attempt:")) then
            ($b | capture("(^|\\n)-?[[:space:]]*Workflow attempt:[[:space:]]*(?<attempt>[1-9][0-9]*)[[:space:]]*($|\\n)").attempt)
          else "1"
          end
      ] | unique[]' <<<"$comments")"
    while IFS= read -r recovery_attempt; do
      [ -n "$recovery_attempt" ] || continue
      if [ "$recovery_attempt" = "$run_attempt" ]; then
        armed_conclusion="$conclusion"
      else
        attempt_run="$(gh api "/repos/${repo}/actions/runs/${run_id}/attempts/${recovery_attempt}")" || {
          echo "Cannot inspect armed Team recovery attempt: ${workflow} run ${run_id} attempt ${recovery_attempt} issue #${issue}" >&2
          exit 1
        }
        [ "$(jq -r '.status // empty' <<<"$attempt_run")" = "completed" ] || {
          echo "Armed Team recovery attempt is not terminal: ${workflow} run ${run_id} attempt ${recovery_attempt} issue #${issue}" >&2
          exit 1
        }
        armed_conclusion="$(jq -r '.conclusion // empty' <<<"$attempt_run")"
      fi
      [ -n "$armed_conclusion" ] || {
        echo "Cannot resolve armed Team recovery conclusion: ${workflow} run ${run_id} attempt ${recovery_attempt} issue #${issue}" >&2
        exit 1
      }
      [ "$armed_conclusion" != "success" ] || continue
      resolved="$(jq -r --arg p "$terminal_prefix" --arg run "$run_id" --arg attempt "$recovery_attempt" '
        [.[][]
          | select(.user.login=="github-actions[bot]")
          | ((.body // "") | gsub("\\\\n"; "\n")) as $b
          | select($b | test("(^|\\n)-?[[:space:]]*Workflow run:[[:space:]]*" + $run + "[[:space:]]*($|\\n)"))
          | select(
              ($b | test("(^|\\n)-?[[:space:]]*Workflow attempt:[[:space:]]*" + $attempt + "[[:space:]]*($|\\n)"))
              or ($attempt=="1" and (($b | test("(^|\\n)Workflow attempt:")) | not))
            )
          | select(
              ($b | startswith($p + ": **PASS**"))
              or ($b | startswith($p + ": **WATCHDOG_RECOVERED**"))
              or ($b | startswith($p + ": **WATCHDOG_RECOVERY_CONFIRMED**"))
              or (($b | startswith($p + ": **FAIL_SAFE**")) and (($b | contains("version was restored")) or ($b | contains("baseline remained active"))))
            )
        ] | length' <<<"$comments")"
      [ "$resolved" -gt 0 ] || {
        echo "Unresolved Team recovery blocks production mutation: ${workflow} run ${run_id} attempt ${recovery_attempt} issue #${issue}" >&2
        exit 1
      }
    done <<<"$armed_attempts"
  done < <(jq -r --arg prefix "$display_prefix" '.[]?.workflow_runs[]? | select((.display_title // "") | startswith($prefix)) | [.id, ((.run_attempt // 1)|tostring), (.conclusion // ""), (.display_title // "")] | @tsv' <<<"$runs")
done
