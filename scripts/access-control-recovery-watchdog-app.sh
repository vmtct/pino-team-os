#!/usr/bin/env bash
set -euo pipefail
issue="$1"
prefix="$2"
run_id="$3"
recovery_attempt="$4"
repo="$5"
body="$(cat)"

canonical_app_state() {
  jq -Sc 'del(.created_at,.updated_at) | .allowed_idps=((.allowed_idps // []) | sort) | .policies=((.policies // []) | map(del(.created_at,.updated_at)) | sort_by(.id)) | .self_hosted_domains=((.self_hosted_domains // []) | sort) | .destinations=((.destinations // []) | sort_by(.type,.uri))'
}
expected_rehomed_state() {
  local from="$1" to="$2"
  jq -Sc --arg from "$from" --arg to "$to" '.domain=$to | .name=$to | .http_only_cookie_attribute=true | if (.self_hosted_domains // []) == [$from] then .self_hosted_domains=[$to] else . end | if (.destinations // []) == [{"type":"public","uri":$from}] then .destinations=[{"type":"public","uri":$to}] else . end'
}
app_id="$(sed -nE 's/^App ID:[[:space:]]*([0-9a-f-]{36})[[:space:]]*$/\1/p' <<<"$body")"
original_b64="$(sed -nE 's/^Original app payload b64:[[:space:]]*([A-Za-z0-9+\/=]+)[[:space:]]*$/\1/p' <<<"$body")"
desired_b64="$(sed -nE 's/^Desired app payload b64:[[:space:]]*([A-Za-z0-9+\/=]+)[[:space:]]*$/\1/p' <<<"$body")"
original_state_b64="$(sed -nE 's/^Original app state b64:[[:space:]]*([A-Za-z0-9+\/=]+)[[:space:]]*$/\1/p' <<<"$body")"
desired_state_b64="$(sed -nE 's/^Desired app state b64:[[:space:]]*([A-Za-z0-9+\/=]+)[[:space:]]*$/\1/p' <<<"$body")"
[ -n "$app_id" ] && [ -n "$original_b64" ] && [ -n "$desired_b64" ] && [ -n "$original_state_b64" ] && [ -n "$desired_state_b64" ] || { echo "Malformed Access-app recovery marker" >&2; exit 1; }
original="$(printf '%s' "$original_b64" | base64 -d)"; desired="$(printf '%s' "$desired_b64" | base64 -d)"
original_state="$(printf '%s' "$original_state_b64" | base64 -d)"; desired_state="$(printf '%s' "$desired_state_b64" | base64 -d)"
jq -e . <<<"$original" >/dev/null; jq -e . <<<"$desired" >/dev/null; jq -e . <<<"$original_state" >/dev/null; jq -e . <<<"$desired_state" >/dev/null
original_state="$(canonical_app_state <<<"$original_state")"; desired_state="$(canonical_app_state <<<"$desired_state")"
[ "$(jq -Sc '{domain,type,allowed_idps:((.allowed_idps // []) | sort),auto_redirect_to_identity:(.auto_redirect_to_identity // false)}' <<<"$original_state")" = "$(jq -Sc '.' <<<"$original")" ] || { echo "Access-app rollback payload does not match captured baseline state" >&2; exit 1; }
[ "$(jq -Sc '{domain,type,allowed_idps:((.allowed_idps // []) | sort),auto_redirect_to_identity:(.auto_redirect_to_identity // false)}' <<<"$desired_state")" = "$(jq -Sc '.' <<<"$desired")" ] || { echo "Access-app mutation payload does not match captured desired state" >&2; exit 1; }
original_domain="$(jq -r '.domain // empty' <<<"$original")"; desired_domain="$(jq -r '.domain // empty' <<<"$desired")"
[ -n "$original_domain" ] && [ -n "$desired_domain" ] || { echo "Access-app recovery payload is missing domain identity" >&2; exit 1; }
expected_desired_state="$(expected_rehomed_state "$original_domain" "$desired_domain" <<<"$original_state")"
api="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}"; auth=(-H "Authorization: Bearer ${CF_ACCESS_API_TOKEN}" -H 'Content-Type: application/json')
apps="$(curl -fsS "${api}/access/apps?per_page=100" "${auth[@]}")"
current="$(jq -c --arg id "$app_id" '.result[]? | select(.id==$id)' <<<"$apps" | head -1)"
[ -n "$current" ] || { gh issue comment "$issue" --repo "$repo" --body "${prefix}: **WATCHDOG_HOLD**\n\nWorkflow run: ${run_id}\nWorkflow attempt: ${recovery_attempt}\nAccess app is missing; recovery cannot prove exact run-owned state."; exit 1; }
current_state="$(canonical_app_state <<<"$current")"
if [ "$current_state" = "$original_state" ]; then result=BASELINE_ALREADY_ACTIVE
elif [ "$current_state" = "$expected_desired_state" ]; then
  response="$(curl -sS -w '\n%{http_code}' -X PUT "${api}/access/apps/${app_id}" "${auth[@]}" -d "$original" || true)"
  code="${response##*$'\n'}"; response_body="${response%$'\n'*}"
  [ "$code" = "200" ] && jq -e '.success==true' <<<"$response_body" >/dev/null || { gh issue comment "$issue" --repo "$repo" --body "${prefix}: **WATCHDOG_HOLD**\n\nWorkflow run: ${run_id}\nWorkflow attempt: ${recovery_attempt}\nAccess-app rollback PUT did not return a successful provider result."; exit 1; }
  restored_apps="$(curl -fsS "${api}/access/apps?per_page=100" "${auth[@]}")"
  restored_app="$(jq -c --arg id "$app_id" '.result[]? | select(.id==$id)' <<<"$restored_apps" | head -1)"
  [ -n "$restored_app" ] && [ "$(canonical_app_state <<<"$restored_app")" = "$original_state" ] || { gh issue comment "$issue" --repo "$repo" --body "${prefix}: **WATCHDOG_HOLD**\n\nWorkflow run: ${run_id}\nWorkflow attempt: ${recovery_attempt}\nAccess-app rollback PUT completed but exact baseline restoration was not proven."; exit 1; }
  result=BASELINE_RESTORED
else gh issue comment "$issue" --repo "$repo" --body "${prefix}: **WATCHDOG_HOLD**\n\nWorkflow run: ${run_id}\nWorkflow attempt: ${recovery_attempt}\nAccess app live full state no longer equals this run's desired state or baseline; recovery refused to overwrite external state."; exit 1
fi

printf '%s\n' "$result"
