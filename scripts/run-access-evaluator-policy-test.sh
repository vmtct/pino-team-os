#!/usr/bin/env bash
set -euo pipefail
tos_aud="${1:?TOS audience}"; approved_email="${2:?approved email}"; blocked_email="${3:?blocked email}"
account="${CF_ACCOUNT_ID:?CF_ACCOUNT_ID}"
access_token="${CF_ACCESS_API_TOKEN:?CF_ACCESS_API_TOKEN}"
test_token="${CF_ACCESS_POLICY_TEST_TOKEN:?CF_ACCESS_POLICY_TEST_TOKEN}"
api="https://api.cloudflare.com/client/v4/accounts/${account}"
access_auth=(-H "Authorization: Bearer ${access_token}" -H 'Content-Type: application/json')
test_auth=(-H "Authorization: Bearer ${test_token}" -H 'Content-Type: application/json')
apps="$(curl -fsS "${api}/access/apps?per_page=100" "${access_auth[@]}")"
app="$(jq -c --arg aud "$tos_aud" '[.result[]? | select((.aud // "")==$aud)] | if length==1 then .[0] else empty end' <<<"$apps")"
[ -n "$app" ] || { echo "TOS Access app not unique" >&2; exit 1; }
app_id="$(jq -r '.id // empty' <<<"$app")"
policies="$(curl -fsS "${api}/access/apps/${app_id}/policies?per_page=100" "${access_auth[@]}")"
policy="$(jq -c '[.result[]? | select(.decision=="allow" and any(.include[]?; .external_evaluation.evaluate_url?=="https://pino-access-evaluator.minhtri-van42.workers.dev/evaluate" and .external_evaluation.keys_url?=="https://pino-access-evaluator.minhtri-van42.workers.dev/keys"))] | if length==1 then .[0] else empty end' <<<"$policies")"
[ -n "$policy" ] || { echo "Canonical TOS external-evaluation policy not unique" >&2; exit 1; }
normalized="$(jq -c '{name,decision,precedence,include,exclude:(.exclude // []),require:(.require // []),session_duration:(.session_duration // "24h")}' <<<"$policy")"
payload="$(jq -nc --argjson p "$normalized" '{policies:[$p]}')"
start="$(curl -fsS -X POST "${api}/access/policy-tests" "${test_auth[@]}" -d "$payload")"
jq -e '.success==true and (.result.id|type=="string")' <<<"$start" >/dev/null
test_id="$(jq -r '.result.id' <<<"$start")"
status_json=""
for _ in $(seq 1 60); do
  status_json="$(curl -fsS "${api}/access/policy-tests/${test_id}" "${test_auth[@]}")"
  status="$(jq -r '.result.status // empty' <<<"$status_json")"
  case "$status" in complete) break ;; blocked|'exceeded time') echo "Access policy test ended ${status}" >&2; exit 1 ;; esac
  sleep 5
done
[ "$(jq -r '.result.status // empty' <<<"$status_json")" = complete ] || { echo "Access policy test did not complete" >&2; exit 1; }
jq -e '(.result.percent_errored // 100)==0 and (.result.total_users // 0)>0' <<<"$status_json" >/dev/null || { echo "Access policy test reported evaluator errors or empty user base" >&2; exit 1; }
users="$(curl -fsS "${api}/access/policy-tests/${test_id}/users?per_page=100" "${test_auth[@]}")"
jq -e --arg a "${approved_email,,}" --arg b "${blocked_email,,}" '
  ([.result[]? | select((.email // "" | ascii_downcase)==$a and .status=="approved")] | length)==1 and
  ([.result[]? | select((.email // "" | ascii_downcase)==$b and .status=="blocked")] | length)==1
' <<<"$users" >/dev/null || { echo "Expected approved/blocked evaluator identities were not proven" >&2; exit 1; }
policy_id="$(jq -r '.id' <<<"$policy")"
jq -nc --arg test "$test_id" --arg policy "$policy_id" --arg app "$app_id" --arg approved "${approved_email,,}" --arg blocked "${blocked_email,,}" '{testId:$test,policyId:$policy,appId:$app,approved:$approved,blocked:$blocked}'
