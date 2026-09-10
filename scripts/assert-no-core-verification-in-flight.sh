#!/usr/bin/env bash
set -euo pipefail
repo=vmtct/pino-core
core_token="${CORE_RELEASE_GH_TOKEN:?PINO_CORE_RELEASE_READ_TOKEN unavailable}"
for workflow in pre-ga-production-local-auth-verification.yml pre-ga-recovery-watchdog.yml; do
  for status in queued in_progress; do
    runs="$(GH_TOKEN="$core_token" gh api "/repos/${repo}/actions/workflows/${workflow}/runs?status=${status}&per_page=100")"
    jq -e '[.workflow_runs[]?] | length==0' <<<"$runs" >/dev/null || { echo "Core verification/recovery workflow ${workflow} is ${status}; refusing cross-repo Team promotion overlap" >&2; exit 1; }
  done
done
