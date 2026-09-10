#!/usr/bin/env bash
set -euo pipefail
worker="${1:?worker}"; old_deployment="${2:?old deployment}"; old_version="${3:?old version}"; candidate_version="${4:?candidate version}"; marker="${5:?marker}"; mode="${6:?mode}"
account="${CF_ACCOUNT_ID:?CF_ACCOUNT_ID}"; token="${CF_API_TOKEN:?CF_API_TOKEN}"
api="https://api.cloudflare.com/client/v4"; auth=(-H "Authorization: Bearer ${token}" -H 'Content-Type: application/json')
state="$(curl -fsS "${api}/accounts/${account}/workers/scripts/${worker}/deployments" "${auth[@]}")"
current_deployment="$(jq -r '.result.deployments[0].id // empty' <<<"$state")"
current_version="$(jq -r '.result.deployments[0].versions[]? | select(.percentage==100) | .version_id // empty' <<<"$state" | head -1)"
current_marker="$(jq -r '.result.deployments[0].annotations["workers/message"] // empty' <<<"$state")"
previous_deployment="$(jq -r '.result.deployments[1].id // empty' <<<"$state")"
[ -n "$current_deployment" ] && [ -n "$current_version" ] || { echo REFUSE_UNRESOLVED; exit 2; }
if [ "$current_deployment" = "$old_deployment" ] && [ "$current_version" = "$old_version" ]; then echo NOOP_BASELINE; exit 0; fi
[ "$current_version" = "$candidate_version" ] && [ "$current_marker" = "$marker" ] && [ "$previous_deployment" = "$old_deployment" ] || { echo REFUSE_OWNERSHIP; exit 2; }
case "$mode" in
  core) CLOUDFLARE_API_TOKEN="$token" CLOUDFLARE_ACCOUNT_ID="$account" npx wrangler versions deploy "${old_version}@100%" --env production -y >/dev/null ;;
  team) CLOUDFLARE_API_TOKEN="$token" CLOUDFLARE_ACCOUNT_ID="$account" npx --yes wrangler@4.126.0 versions deploy "${old_version}@100%" -y >/dev/null ;;
  access) CLOUDFLARE_API_TOKEN="$token" CLOUDFLARE_ACCOUNT_ID="$account" npx --yes wrangler@4.127.1 versions deploy "${old_version}@100%" --name "$worker" -y >/dev/null ;;
  web) CLOUDFLARE_API_TOKEN="$token" CLOUDFLARE_ACCOUNT_ID="$account" npx wrangler versions deploy "${old_version}@100%" --name "$worker" -y >/dev/null ;;
  *) echo REFUSE_MODE; exit 2 ;;
esac
after="$(curl -fsS "${api}/accounts/${account}/workers/scripts/${worker}/deployments" "${auth[@]}")"
[ "$(jq -r '.result.deployments[0].versions[]? | select(.percentage==100) | .version_id // empty' <<<"$after" | head -1)" = "$old_version" ] || { echo REFUSE_POSTFLIGHT; exit 2; }
echo RESTORED
