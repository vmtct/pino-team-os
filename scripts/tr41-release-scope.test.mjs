import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './tr41-release-scope.mjs';
test('pilot-only matching baseline is static pass, not production admission',()=>{
  const r=evaluate(['app/bo/learners/BoLearnersView.tsx','lib/bo-api.ts'],['app/bo/learners/page.tsx'],['app/bo/learners/page.tsx']);
  assert.equal(r.status,'SCOPE_STATIC_PASS_NOT_RELEASE_ADMISSION');
  assert.deepEqual(r.failures,[]);
});
test('nonpilot TV transitive dependencies fail closed',()=>{
  const r=evaluate(['app/bo/pinoria-tv-operator/page.tsx','lib/pap657-dialogue-runtime.ts','lib/f3-delivery-api.ts'],[],[]);
  assert.deepEqual(r.failures,['NON_PILOT_FILES:3']);
});
test('baseline captured later than serving is not a silent retirement',()=>{
  const r=evaluate([],['app/bo/pinoria-tv-operator/page.tsx'],[]);
  assert.deepEqual(r.failures,['BASELINE_SERVING_DRIFT:1:0']);
});
test('unknown files cannot slip into isolated release',()=>{
  const r=evaluate(['app/api/payroll/route.ts'],[],[]);
  assert.deepEqual(r.failures,['UNCLASSIFIED_FILES:1']);
});
