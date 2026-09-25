import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url); const r=(p:string)=>readFileSync(new URL(p,root),'utf8');
const access=['tos-canonical-external-eval.yml','tos-google-idp-reconcile.yml','bo-manager-access-reconcile.yml'];
const perimeter=r('.github/workflows/team-access-perimeter-retire.yml'); const watchdog=r('.github/workflows/access-control-recovery-watchdog.yml'); const watchdogApp=r('scripts/access-control-recovery-watchdog-app.sh'); const recoveryConfirm=r('.github/workflows/team-access-recovery-confirm.yml'); const releaseWatch=r('.github/workflows/production-release-recovery-watchdog.yml'); const unresolved=r('scripts/assert-no-unresolved-recovery.sh'); const idp=r('.github/workflows/tos-google-idp-reconcile.yml'); const externalEval=r('.github/workflows/tos-canonical-external-eval.yml'); const boAccess=r('.github/workflows/bo-manager-access-reconcile.yml');
test('H3 F03 Access mutation authority and recovery are exact-attempt scoped',()=>{for(const f of access){const t=r('.github/workflows/'+f); assert.match(t,/GITHUB_RUN_ATTEMPT.*= "1"/); assert.match(t,/Workflow attempt: \$\{GITHUB_RUN_ATTEMPT\}/);} assert.match(watchdog,/workflow_run\.run_attempt/); assert.match(watchdog,/recovery_attempt=.*Workflow attempt/); assert.match(watchdog,/\[run:\$\{run_id\}\]\[attempt:\$\{recovery_attempt\}\]/); assert.match(unresolved,/run_attempt/); assert.match(unresolved,/armed_attempts=/); assert.match(unresolved,/actions\/runs\/\$\{run_id\}\/attempts\/\$\{recovery_attempt\}/); assert.match(unresolved,/Workflow run:\[\[:space:\]\]\*/); assert.match(unresolved,/Workflow attempt:\[\[:space:\]\]\*/); assert.doesNotMatch(unresolved,/contains\("Workflow run: " \+ \$run\)/); assert.doesNotMatch(unresolved,/contains\("Workflow attempt: " \+ \$attempt\)/);});
test('H3 F02 non-success Team runs require exact-attempt terminal evidence',()=>{for(const t of [watchdog,releaseWatch]){assert.doesNotMatch(t,/already has PASS; watchdog no-op/); assert.doesNotMatch(t,/terminal PASS; watchdog/);} assert.match(unresolved,/Workflow run:/); assert.match(unresolved,/Workflow attempt:/); assert.match(unresolved,/WATCHDOG_RECOVERED/); assert.match(unresolved,/WATCHDOG_RECOVERY_CONFIRMED/);});
test('Access recovery watchdog accepts canonical dynamic run-name identities and recovers the armed attempt on rerun',()=>{for(const pattern of [/Access sync worker secret #/,/BO manager Access reconcile #/,/TOS Google IdP reconcile #/,/TOS canonical external evaluation #/,/Team Access perimeter retirement #/]) assert.match(watchdog,pattern); assert.match(watchdog,/recovery_attempt=.*Workflow attempt/); assert.match(watchdog,/actions\/runs\/\$\{run_id\}\/attempts\/\$\{recovery_attempt\}/); assert.match(watchdog,/armed_conclusion/); assert.match(watchdog,/durable PASS evidence/); assert.match(watchdog,/WATCHDOG_RECOVERED/); assert.match(watchdog,/Workflow run:\[\[:space:\]\]\*/); assert.match(watchdog,/Workflow attempt:\[\[:space:\]\]\*/); assert.match(watchdog,/current_state=.*del\(\.created_at/); assert.doesNotMatch(watchdog,/^"/m);});
test('Access recovery watchdog normalizes literal escaped-newline GitHub comment receipts before exact run/attempt matching',()=>{const literalNewlineNormalizer=String.raw`gsub("\\\\n"; "\n")`; assert.equal(watchdog.split(literalNewlineNormalizer).length-1,6);});
test('Access recovery requires complete object-state CAS before rollback or delete',()=>{for(const t of [idp,externalEval,boAccess,watchdog]) assert.match(t,/del\(\.created_at,\.updated_at/); assert.match(idp,/Original app state b64/); assert.match(idp,/Desired app state b64/); assert.match(externalEval,/Original policy state b64/); assert.match(externalEval,/Desired policy state b64/); assert.match(boAccess,/RECOVERY_STATE_CAPTURED/); assert.match(boAccess,/Created policy state b64/); assert.match(watchdog,/Exact post-create BO policy state receipt is absent/); assert.match(watchdog,/Run-owned BO policy or full policy-set state drifted/); assert.doesNotMatch(watchdog,/select\(\.id==\$id\) \| \{name,decision,precedence,include/);});
test('Access recovery pre-DEEP contract proves capture CAS payload rollback receipt and failure semantics',()=>{for(const t of [idp,externalEval]){assert.match(t,/pre-mutation full-state CAS/); assert.match(t,/full state drifted after capture; mutation withheld/); assert.match(t,/post-mutation full state does not equal the preserved desired state/); assert.match(t,/durable RECOVERY_ARMED authority remains/);} assert.match(boAccess,/canonical_policy_set_state/); assert.match(boAccess,/Mutation policy payload b64/); assert.match(boAccess,/Rollback baseline policies state b64/); assert.match(boAccess,/BO policy set drifted after capture; mutation withheld/); assert.match(boAccess,/post-mutation policy-set state drifted/); assert.match(watchdog,/IdP mutation payload does not match captured desired state/); assert.match(watchdog,/IdP rollback payload does not match captured baseline state/); assert.match(watchdog,/Evaluator mutation payload does not match captured desired state/); assert.match(watchdog,/Evaluator rollback payload does not match captured baseline state/); assert.match(watchdog,/BO mutation payload does not match captured created state/); assert.match(watchdogApp,/rollback PUT completed but exact baseline restoration was not proven/); assert.match(watchdog,/rollback DELETE completed but exact baseline policy-set restoration was not proven/); assert.match(watchdog,/Workflow attempt: \$\{recovery_attempt\}/);});
test('Access perimeter retirement recovery is full-state CAS and receipt-safe',()=>{for(const t of [perimeter,watchdogApp]){assert.match(t,/Original app state b64/); assert.match(t,/Desired app state b64/); assert.match(t,/\.policies=\(\(\.policies \/\/ \[\]\)/);} assert.match(perimeter,/post-mutation full state does not equal the preserved desired state/); assert.match(perimeter,/restored_state.*original_state/); assert.match(watchdogApp,/Access-app rollback payload does not match captured baseline state/); assert.match(watchdogApp,/Access-app mutation payload does not match captured desired state/); assert.match(watchdogApp,/rollback PUT did not return a successful provider result/); assert.match(watchdogApp,/rollback PUT completed but exact baseline restoration was not proven/); assert.match(watchdogApp,/live full state no longer equals this run's desired state or baseline/);});
test('Access perimeter expected state includes deterministic Cloudflare rehome normalization',()=>{for(const t of [perimeter,watchdogApp,recoveryConfirm]){assert.match(t,/expected_rehomed_state/); assert.match(t,/self_hosted_domains/); assert.match(t,/destinations/); assert.match(t,/\.name=\$to/); assert.match(t,/\.domain=\$to/);} assert.match(perimeter,/desired_state=.*expected_rehomed_state/); assert.match(watchdogApp,/expected_desired_state=.*expected_rehomed_state/);});
test('Access recovery confirmation is exact-attempt scoped, read-only, and terminal-receipt compatible',()=>{assert.match(recoveryConfirm,/\[GPT\] Team Access recovery confirm/); assert.match(recoveryConfirm,/SOURCE_ISSUE/); assert.match(recoveryConfirm,/SOURCE_RUN/); assert.match(recoveryConfirm,/SOURCE_ATTEMPT/); assert.match(recoveryConfirm,/actions\/runs\/\$\{source_run\}\/attempts\/\$\{source_attempt\}/); assert.match(recoveryConfirm,/RECOVERY_ARMED/); assert.match(recoveryConfirm,/WATCHDOG_RECOVERY_CONFIRMED/); assert.match(recoveryConfirm,/DESIRED_STATE_COMMITTED/); assert.match(recoveryConfirm,/BASELINE_ALREADY_ACTIVE/); assert.doesNotMatch(recoveryConfirm,/-X[[:space:]]+(PUT|POST|DELETE)/); assert.match(recoveryConfirm,/Live Access app state is neither the captured baseline nor the exact provider-normalized desired state/);});
test('Access terminal receipt identity accepts canonical Markdown bullets',()=>{for(const t of [watchdog]){assert.match(t,/-?\[\[:space:\]\]\*Workflow run:/); assert.match(t,/-?\[\[:space:\]\]\*Workflow attempt:/);} assert.match(unresolved,/-?\[\[:space:\]\]\*Workflow run:/);});
test('BO recovery reconciles ambiguous POST and complete paginated policy state',()=>{assert.match(boAccess,/fetch_policies\(\)/); assert.match(boAccess,/result_info\.total_pages/); assert.match(boAccess,/post_attempted=true/); assert.match(boAccess,/BO policy POST outcome is uncertain/); assert.match(boAccess,/recovery_policy_name/); assert.match(boAccess,/Existing BO manager policy has broadened or noncanonical authorization shape/); assert.match(watchdog,/Cannot read complete BO policy set for recovery/);});

test('BO policy payload comparison canonicalizes both JSON operands',()=>{
  const script=String.raw`
name='PINO BO COO Manager [run:123][attempt:1]'; email='manager@example.com'
payload="$(jq -nc --arg name "$name" --arg email "$email" '{name:$name,decision:"allow",precedence:60,include:[{email:{email:$email}}],exclude:[],require:[]}')"
provider="$(jq -nc --arg name "$name" --arg email "$email" '{require:[],id:"fixture-policy",include:[{email:{email:$email}}],exclude:[],precedence:60,decision:"allow",name:$name}')"
left="$(jq -Sc '{name,decision,precedence,include,exclude:(.exclude // []),require:(.require // [])}' <<<"$provider")"
right="$(jq -Sc '.' <<<"$payload")"
test "$left" = "$right"
`;
  const result=spawnSync('bash',['-lc',script],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
test('BO ambiguous committed POST rollback recognizes exact provider state and restores baseline',()=>{
  const start=boAccess.indexOf('          canonical_policy_state() {');
  const end=boAccess.indexOf('          fail() {',start);
  assert.ok(start>=0&&end>start);
  const block=boAccess.slice(start,end).replace(/^          /gm,'');
  const fixture=String.raw`
api='https://api.cloudflare.com/client/v4'; base='accounts/fixture'; app_id='fixture-app'
recovery_policy_name='PINO BO COO Manager [run:123][attempt:1]'; email='manager@example.com'; auth=()
payload="$(jq -nc --arg name "$recovery_policy_name" --arg email "$email" '{name:$name,decision:"allow",precedence:60,include:[{email:{email:$email}}],exclude:[],require:[]}')"
provider="$(jq -nc --arg name "$recovery_policy_name" --arg email "$email" '{require:[],id:"fixture-policy",include:[{email:{email:$email}}],exclude:[],precedence:60,decision:"allow",name:$name}')"
baseline_policies_state='[]'; post_attempted=true; created_policy_id=''; created_policy_state=''; expected_post_policy_set_state=''; deleted=0
fetch_policies(){ if [ "$deleted" -eq 0 ]; then jq -nc --argjson p "$provider" '{success:true,result:[$p],result_info:{total_pages:1}}'; else printf '%s\n' '{"success":true,"result":[],"result_info":{"total_pages":1}}'; fi; }
curl(){ deleted=1; return 0; }
rollback && echo AMBIGUOUS_ROLLBACK_SUCCESS
`;
  const result=spawnSync('bash',['-lc',block+'\n'+fixture],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(result.stdout,/AMBIGUOUS_ROLLBACK_SUCCESS/);
});
test('failed exact attempt can close on terminal PASS without authorizing rollback',()=>{assert.match(unresolved,/startswith\(\$p \+ ": \*\*PASS\*\*"\)/);});
test('BO local rollback publishes durable exact-attempt closure consumed by watchdog',()=>{assert.match(boAccess,/WATCHDOG_RECOVERY_CONFIRMED/); assert.match(boAccess,/Workflow run: \${GITHUB_RUN_ID}/); assert.match(boAccess,/Workflow attempt: \${GITHUB_RUN_ATTEMPT}/); assert.match(watchdog,/WATCHDOG_RECOVERY_CONFIRMED/);});
test('IdP canonical recovery state preserves nonvolatile policies',()=>{assert.match(idp,/\.policies=\(\(\.policies \/\/ \[\]\)/); assert.match(watchdog,/\.policies=\(\(\.policies \/\/ \[\]\)/);});
test('H3 remediation tests are repository-relative and CI portable',()=>{assert.doesNotMatch(r('lib/h2-remediation.test.ts'),/\/home\/tri\/pino-work/);});


test('Access app watchdog compares provider-normalized semantic desired state',()=>{
  assert.match(watchdog,/access-control-recovery-watchdog-app\.sh/);
  assert.match(watchdogApp,/current_state="\$\(canonical_app_state <<<"\$current"\)"/);
  assert.match(watchdogApp,/elif \[ "\$current_state" = "\$expected_desired_state" \]; then/);
  assert.doesNotMatch(watchdogApp,/elif \[ "\$current_state" = "\$desired_state" \]; then/);
});

test('Access recovery confirmation proves unrelated app full-state before closing fence',()=>{
  const confirm=r('.github/workflows/team-access-recovery-confirm.yml');
  assert.match(perimeter,/Other app ID: \$other_id/);
  assert.match(perimeter,/Other app state b64: \$other_before_b64/);
  assert.match(confirm,/other_state_b64=/);
  assert.match(confirm,/Unrelated Team Access app full state drifted from the captured baseline/);
  assert.match(confirm,/assert_legacy_bo_canonical/);
  assert.match(confirm,/source_issue" = "430"/);
  assert.match(confirm,/source_run" = "35985302696"/);
  assert.match(confirm,/SOURCE_ISSUE does not match the exact source workflow run identity/);
});

test('Access recovery confirmation emits only read-only safe state-drift diagnostics on mismatch',()=>{
  const confirm=r('.github/workflows/team-access-recovery-confirm.yml');
  assert.match(confirm,/safe_state_diagnostic/);
  assert.match(confirm,/differing top-level keys/);
  assert.match(confirm,/Current policy \/ IdP counts/);
  assert.match(confirm,/Read-only diagnostic was attached/);
  assert.doesNotMatch(confirm,/Current policy members:/);
});

test('Access recovery confirmation accepts only relative or exact same-host Staff login redirects',()=>{
  const confirm=r('.github/workflows/team-access-recovery-confirm.yml');
  assert.match(confirm,/\/staff-login\|"https:\/\/\$\{host\}\/staff-login"/);
  assert.match(confirm,/exact same-host local Staff login/);
});
test('Access recovery confirmation run block remains valid Bash',()=>{assert.doesNotMatch(recoveryConfirm,/esac"/);});