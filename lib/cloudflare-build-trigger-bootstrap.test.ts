import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/auto-merge.yml', 'utf8');
const boundary = JSON.parse(readFileSync('ops/team-production-build-boundary.json', 'utf8')) as Record<string, unknown>;

function stepScript(stepName: string, nextStepName?: string) {
  const marker = `      - name: ${stepName}`;
  const start = workflow.indexOf(marker);
  assert.ok(start >= 0, `missing workflow step ${stepName}`);
  const end = nextStepName ? workflow.indexOf(`      - name: ${nextStepName}`, start + marker.length) : workflow.length;
  assert.ok(end > start, `cannot bound workflow step ${stepName}`);
  const step = workflow.slice(start, end);
  const run = step.indexOf('        run: |\n');
  assert.ok(run >= 0, `${stepName} must contain a literal run block`);
  return step.slice(run + '        run: |\n'.length).split('\n').map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n').trimEnd();
}

const authority = stepScript('Validate Founder bootstrap authority', 'Validate exact Team main build trigger');
const validation = stepScript('Validate exact Team main build trigger');
const governed = `${authority}\n${validation}`;
const EXPECTED_WORKFLOW_SHA256 = '3b7d5fe47a9b4088f06839bff57ab73199f50d2da5f00d2ca35ba81bcf01c59d';

function assertWorkflowPinned(candidate: string) {
  const digest = createHash('sha256').update(candidate).digest('hex');
  assert.equal(digest, EXPECTED_WORKFLOW_SHA256, 'bootstrap workflow changed outside the independently reviewed exact semantic snapshot');
}

function logicalLines(script: string) {
  assert.doesNotMatch(script.replace(/<<</g, ''), /<<(?=[^<])/m, 'heredocs are forbidden in governed shell');
  return script.replace(/\\+\s*\n\s*/g, ' ').split('\n').map((line) => line.trim()).filter(Boolean);
}
function assertExactGuard(script: string, guard: string) {
  const matches = logicalLines(script).filter((line) => line.startsWith(guard));
  assert.equal(matches.length, 1, `expected exactly one executable guard: ${guard}`);
  assert.match(matches[0], /\|\|\s*\{.*\bexit 1;\s*\}$/, `${guard} must fail closed with exit 1`);
}

function assertOrdered(script: string, tokens: string[], label: string) {
  let cursor = -1;
  for (const token of tokens) {
    const at = script.indexOf(token, cursor + 1);
    assert.ok(at > cursor, `${label}: missing or out-of-order ${token}`);
    cursor = at;
  }
}

function assertNoWriteSurface(script: string) {
  const lines = logicalLines(script);
  const logical = lines.join('\n');
  assert.doesNotMatch(logical, /\b(?:eval|source|alias)\b|\b(?:bash|sh)\s+-c\b/, 'dynamic shell execution is forbidden');
  assert.doesNotMatch(script, /\bfunction\b|^[A-Za-z_][A-Za-z0-9_]*\s*\(\)\s*\{/m, 'shell helper functions are forbidden');
  assert.doesNotMatch(script, /\b(?:POST|PUT|PATCH|DELETE)\b/, 'HTTP write methods are forbidden');
  assert.doesNotMatch(script, /(?:^|\s)(?:-X\S*|--data(?:-raw|-binary|-urlencode)?(?:=|\s)|--json(?:=|\s)|--form(?:-string)?(?:=|\s)|--upload-file(?:=|\s)|--next(?:=|\s|$))/m, 'curl write/multi-request options are forbidden');
  assert.doesNotMatch(script, /(?:^|\s)(?:-d|-F|-T)\S*/m, 'attached curl write options are forbidden');
  assert.doesNotMatch(script, /\bauth\s*(?:=|\+=|\[[^\]]+\]\s*=)/, 'curl option arrays are forbidden');
  for (const line of lines.filter((line) => /\bcurl\b/.test(line))) {
    assert.equal((line.match(/\bcurl\b/g) ?? []).length, 1, 'one logical line may issue only one curl request');
    assert.match(line, /curl -q -fsS --request GET "[^\"]+" -H "Authorization: Bearer \$\{CF_API_TOKEN\}" -H "Content-Type: application\/json"\)/, `curl must disable startup config and issue one explicit GET: ${line}`);
  }
  for (const line of lines.filter((line) => /\bgh\s+api\b/.test(line))) {
    assert.doesNotMatch(line, /(?:--method|--raw-field|--field|--input|(?:^|\s)-[fFX](?:=|\s))/, 'gh api write flags are forbidden');
  }
  assert.doesNotMatch(logical, /\bgit\s+push\b/, 'git push is forbidden');
  assert.doesNotMatch(logical, /\bgh\s+(?:issue|pr|workflow|secret|variable|release)\b|\bgh\s+run\s+rerun\b/, 'GitHub write subcommands are forbidden');
  assert.doesNotMatch(logical, /\bwrangler\b.*?\b(?:deploy|delete|secret\s+put|versions\s+upload)\b/, 'Wrangler mutations are forbidden');
}

function assertNoEarlySuccess(script: string) {
  const lines = logicalLines(script);
  assert.doesNotMatch(script, /(^|[;&|]\s*)exit\s+0\b|(^|[;&|]\s*)return\s+0\b/m, 'early success is forbidden');
  assert.equal(lines[0], 'set -euo pipefail', 'governed script must start in strict mode');
}

function assertBashSyntax(script: string) {
  const result = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'bash -n failed');
}

test('bootstrap operator is validation-only and syntactically executable', () => {
  assertWorkflowPinned(workflow);
  assert.equal(boundary.accountId, '952c3c8a236f8e4cbcf6ee10b86ad70c');
  assert.equal(boundary.worker, 'pino-team-os');
  assert.equal(boundary.productionBranch, 'main');
  assert.match(String(boundary.deployCommand ?? ''), /^npx wrangler versions upload /);
  assert.equal(boundary.automaticTrafficPromotion, false);
  assert.equal(boundary.promotionAuthority, '.github/workflows/team-runtime-production-release.yml');
  assertBashSyntax(authority);
  assertBashSyntax(validation);
  assertNoWriteSurface(governed);
  assertNoEarlySuccess(authority);
  assertNoEarlySuccess(validation);
});
test('founder and exact-head authority guards are executable, ordered, and fail closed', () => {
  const authorityGuards = [
    '[ "$GITHUB_ACTOR" = "vmtct" ]',
    '[ "$GITHUB_RUN_ATTEMPT" = "1" ]',
    '[ "$REPAIR_CONFIRM" = "REPAIR_TEAM_BUILD_TRIGGER" ]',
    '[[ "$EXPECTED_MAIN_SHA" =~ ^[0-9a-f]{40}$ ]]',
    '[[ "$EXPECTED_OPERATOR_SHA" =~ ^[0-9a-f]{40}$ ]]',
    '[[ "$EXPECTED_TRIGGER_UUID" =~ ^[0-9a-fA-F-]{36}$ ]]',
    '[[ "$GITHUB_REF" == refs/heads/ops/plt-team-trigger-bootstrap-* ]]',
    '[ "$GITHUB_SHA" = "$EXPECTED_OPERATOR_SHA" ]',
    '[ "$(git rev-parse HEAD)" = "$EXPECTED_OPERATOR_SHA" ]',
    '[ -z "$(git status --porcelain)" ]',
    '[ "$parent_sha" = "$EXPECTED_MAIN_SHA" ]',
    '[ "$remote_main" = "$EXPECTED_MAIN_SHA" ]',
    '[ "$files" = "$expected_files" ]',
  ];
  assertOrdered(authority, authorityGuards, 'founder authority');
  for (const guard of authorityGuards) assertExactGuard(authority, guard);
});

test('Cloudflare validation binds repository identity, trigger identity, revision, serving identity, and final main', () => {
  const validationGuards = [
    '[ -n "${CF_API_TOKEN:-}" ]',
    '[[ "$CF_ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]]',
    '[ -n "$WORKER_NAME" ]',
    '[ "$PRODUCTION_BRANCH" = "main" ]',
    '[ -n "$expected" ]',
    '[ "$GITHUB_SHA" = "$EXPECTED_OPERATOR_SHA" ]',
    '[ "$main_before" = "$EXPECTED_MAIN_SHA" ]',
    '[ -n "$repo_id" ] && [ -n "$repo_owner" ] && [ -n "$repo_name" ]',
    '[ -n "$worker_tag" ]',
    '[ "$(jq \'length\' <<<"$matches")" -eq 1 ]',
    '[ "$trigger_uuid" = "$EXPECTED_TRIGGER_UUID" ]',
    '[ -n "$baseline_fingerprint" ] && [ -n "$baseline_modified" ]',
    '[ "$live_deploy" = "$expected" ]',
    '[ "$(jq \'length\' <<<"$serving_entries_before")" -eq 1 ]',
    '[ -n "$deployment_before" ] && [ -n "$serving_before" ]',
    '[ "$(jq \'length\' <<<"$verify_matches")" -eq 1 ]',
    '[ "$(jq -r \'.[0].trigger_uuid // empty\' <<<"$verify_matches")" = "$EXPECTED_TRIGGER_UUID" ]',
    '[ "$(jq -cS \'.result | del(.modified_on)\' <<<"$verify_detail")" = "$baseline_fingerprint" ]',
    '[ "$(jq -r \'.result.modified_on // empty\' <<<"$verify_detail")" = "$baseline_modified" ]',
    '[ "$(jq -r \'.result.deploy_command // ""\' <<<"$verify_detail")" = "$expected" ]',
    '[ "$(jq \'length\' <<<"$serving_entries_after")" -eq 1 ]',
    '[ -n "$serving_after" ]',
    '[ "$deployment_after" = "$deployment_before" ]',
    '[ "$serving_after" = "$serving_before" ]',
    '[ "$main_final" = "$EXPECTED_MAIN_SHA" ]',
  ];
  assertOrdered(validation, validationGuards, 'Cloudflare validation');
  for (const guard of validationGuards) assertExactGuard(validation, guard);
  for (const proof of ['provider_type', 'provider_account_name', 'repo_id', 'repo_name', 'branch_includes', 'branch_excludes', 'trigger_uuid']) {
    assert.ok(validation.includes(proof), `validation must bind ${proof}`);
  }
  assert.match(validation, /Live deploy_command is not canonical; perform a separate authorized repair before release/);
  assert.match(validation, /no Cloudflare mutation performed/);
  assert.match(validation, /serving_entries_before/);
  assert.match(validation, /serving_entries_after/);
  assert.doesNotMatch(validation, /serving_(?:before|after)=.*head -1/);
});
test('oracle rejects dead guards, early success, and semantic mutation counterexamples', () => {
  const actor = '[ "$GITHUB_ACTOR" = "vmtct" ]';
  assert.throws(() => assertExactGuard(authority.replace(`${actor} ||`, `${actor} &&`), actor));
  assert.throws(() => assertExactGuard(authority.replace(actor, `# ${actor}`), actor));
  assert.throws(() => assertExactGuard(authority.replace(actor, `echo '${actor} || { exit 1; }'`), actor));
  assert.throws(() => assertExactGuard(authority.replace(actor, `cat <<EOF\n${actor} || { exit 1; }\nEOF`), actor));
  assert.throws(() => assertNoEarlySuccess(authority.replace('set -euo pipefail', 'set -euo pipefail\nexit 0')));
  assert.throws(() => assertWorkflowPinned(workflow.replace('main_before="$(gh api', 'main_before="$EXPECTED_MAIN_SHA" # $(gh api')));
  assert.throws(() => assertWorkflowPinned(workflow.replace('[ "$GITHUB_ACTOR" = "vmtct" ] ||', 'if false; then\n          [ "$GITHUB_ACTOR" = "vmtct" ] ||')));
  assert.throws(() => assertWorkflowPinned(workflow.replace('      - name: Validate Founder bootstrap authority', '      - name: Hidden mutation\n        run: git push origin HEAD\n      - name: Validate Founder bootstrap authority')));
  assert.throws(() => assertWorkflowPinned(workflow.replace('curl -q -fsS --request GET', 'curl -q -fsS --request POST')));

  const mutations = [
    `${governed}\ncurl -dfoo https://example.invalid`,
    `${governed}\ncurl -q -fsS -XPOST "https://example.invalid" -H "Authorization: Bearer ${'${CF_API_TOKEN}'}" -H "Content-Type: application/json"`,
    `${governed}\ncurl -fsS --request GET "https://example.invalid" -H "Authorization: Bearer ${'${CF_API_TOKEN}'}" -H "Content-Type: application/json"`,
    `${governed}\ncurl -fsS "${'${api}'}/x" "${'${auth[@]}'}" --next -X DELETE https://example.invalid`,
    `${governed}\nauth+=(--data evil)`,
    `${governed}\nopts=evil\ncurl -fsS "${'${api}'}/x" "${'${auth[@]}'}" "$opts"`,
    `${governed}\ngh api \\\n      --method POST /repos/x/y`,
    `${governed}\ngit \\\n      push origin HEAD`,
    `${governed}\nnpx wrangler \\\n      versions upload`,
    `${governed}\neval "$danger"`,
  ];
  for (const [index, mutated] of mutations.entries()) assert.throws(() => assertNoWriteSurface(mutated), `mutation fixture ${index} must be rejected`);
});

test('normal verification includes this oracle', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };
  assert.match(pkg.scripts?.test ?? '', /lib\/\*\.test\.ts/);
  assert.match(pkg.scripts?.['pino:verify'] ?? '', /npm test/);
});
