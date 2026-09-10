#!/usr/bin/env bash
set -euo pipefail
repo="${1:?repo}"; issue_number="${2:?issue}"; expected_title="${3:?title}"; expected_hash="${4:?hash}"
issue_json="$(gh api "/repos/${repo}/issues/${issue_number}")"
jq -e --arg title "$expected_title" '.state=="open" and .user.login=="vmtct" and .title==$title' <<<"$issue_json" >/dev/null
body="$(jq -r '.body // ""' <<<"$issue_json")"
actual_hash="$(printf '%s' "$body" | sha256sum | cut -d' ' -f1)"
[ "$actual_hash" = "$expected_hash" ] || { echo "Founder authorization body changed" >&2; exit 1; }
