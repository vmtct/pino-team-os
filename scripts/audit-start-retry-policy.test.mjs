import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MAX_SAFE_START_RETRIES,isSafeNoWriteStartResult,isSafeNoWriteStartRecord,canSafeRetryStart,retryIdempotencyKey} from './audit-start-retry-policy.mjs';

const safeFailure={reason:'QUEUE_TTL_EXPIRED',operation:'SKIPPED',queueTtlMs:120000,writeAttempted:false};

test('historical queue TTL NOT_STARTED receipt is the only safe start retry class',()=>{
  assert.equal(isSafeNoWriteStartResult({outcome:'NOT_STARTED',evidence:safeFailure}),true);
  assert.equal(isSafeNoWriteStartRecord({state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:safeFailure}),true);
  assert.equal(canSafeRetryStart({state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:safeFailure}),true);
  assert.equal(DEFAULT_MAX_SAFE_START_RETRIES,1);
});

test('write-attempted, unknown, confirmed, and legacy bootstrap cases never qualify',()=>{
  for(const record of [
    {state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:{...safeFailure,writeAttempted:true}},
    {state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:{...safeFailure,writeAttempted:null}},
    {state:'OUTCOME_UNKNOWN',outcome:'CONFIRMED',failure:safeFailure},
    {state:'BOOTSTRAP_OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:safeFailure},
    {state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:{...safeFailure,reason:'OTHER'}},
  ]) assert.equal(canSafeRetryStart(record),false);
});

test('safe retry is bounded once and receives a new idempotency key',()=>{
  const record={state:'OUTCOME_UNKNOWN',outcome:'NOT_STARTED',failure:safeFailure,safeStartRetryCount:1};
  assert.equal(canSafeRetryStart(record),false);
  assert.equal(retryIdempotencyKey('abc',0),'chatgpt-audit/start/abc');
  assert.equal(retryIdempotencyKey('abc',1),'chatgpt-audit/start/abc/safe-retry-1');
});
