import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUiPath, assessFiles, assessPR } from './guarded-ui-automerge.mjs';

test('safe BO/TOS/HO presentation and bounded smoke docs', () => {
  for (const file of ['app/bo/components/registration/StudentRow.tsx', 'app/tos/lesson/page.tsx', 'app/ho/styles/theme.module.css', 'public/bo/icon.webp', 'docs/automation/guarded-automerge-smoke-1.md']) {
    assert.equal(safeUiPath(file), true, file);
  }
});
test('never auto-merge auth, backend, infra, scripts, staging deploy or production', () => {
  for (const file of ['app/api/bo/create/route.ts', 'app/bo/auth/page.tsx', 'app/bo/users/page.tsx', 'lib/bo-auth.ts', 'scripts/verify-ci.mjs', '.github/workflows/pr-validation.yml', 'wrangler.ho-staging.json', 'app/bo/components/roles/RoleEditor.tsx', 'app/bo/components/secret/Secret.tsx', 'app/ho/api/save.ts', 'app/bo/layout.tsx', 'public/bo/runtime.js', 'app/bo/components/a/../../hack.tsx', 'app/bo/components/employee/Guard.tsx\0']) {
    assert.equal(safeUiPath(file), false, file);
  }
});
test('all changed and renamed paths must be eligible and bounded', () => {
  assert.equal(assessFiles([{ filename: 'app/bo/components/Students.tsx' }]).ok, true);
  assert.equal(assessFiles([{ filename: 'app/bo/components/Students.tsx' }, { filename: 'lib/auth.ts' }]).ok, false);
  assert.equal(assessFiles([{ filename: 'app/bo/components/Students.tsx', previous_filename: 'lib/auth.ts' }]).ok, false);
  assert.equal(assessFiles([]).ok, false);
  assert.equal(assessFiles(Array(41).fill({ filename: 'app/bo/components/Foo.tsx' })).ok, false);
});
test('new author-owned PR allowed, old/draft/fork/holds/review requests blocked', () => {
  const base = {
    number: 9999, state: 'open', draft: false, created_at: '2026-10-27T10:00:00Z',
    base: { ref: 'main' }, head: { repo: { full_name: 'vmtct/pino-team-os' }, sha: 'abc' },
    user: { login: 'vmtct' }, labels: [], requested_reviewers: [], requested_teams: [], mergeable_state: 'clean'
  };
  assert.equal(assessPR(base, '2026-10-27T09:00:00Z'), null);
  assert.match(assessPR(base, '2026-10-27T11:00:00Z'), /pre-existing/);
  assert.match(assessPR({ ...base, draft: true }, '2026-10-27T09:00:00Z'), /draft/);
  assert.match(assessPR({ ...base, labels: [{ name: 'merge-hold' }] }, '2026-10-27T09:00:00Z'), /hold/);
  assert.match(assessPR({ ...base, requested_reviewers: [{ login: 'reviewer' }] }, '2026-10-27T09:00:00Z'), /review/);
  assert.match(assessPR({ ...base, head: { repo: { full_name: 'stranger/fork' } } }, '2026-10-27T09:00:00Z'), /untrusted/);
  assert.match(assessPR({ ...base, body: 'STOP_BEFORE_MERGE: blocked' }, '2026-10-27T09:00:00Z'), /hold/);
});
