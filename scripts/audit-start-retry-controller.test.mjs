import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const dir=fileURLToPath(new URL('.',import.meta.url));
const pino=fs.readFileSync(dir+'pino-chatgpt-audit.mjs','utf8');
const work=fs.readFileSync(dir+'audit-work.mjs','utf8');
const ensure=fs.readFileSync(dir+'review-ensure.mjs','utf8');

test('prompt-first transport retries only through bounded safe-no-write policy',()=>{
  assert.match(pino,/from '\.\/audit-start-retry-policy\.mjs'/);
  assert.match(pino,/canSafeRetryStart\(record\)/);
  assert.match(pino,/isSafeNoWriteStartResult\(result\)/);
  assert.match(pino,/retryIdempotencyKey\(reviewKey,safeStartRetryCount\(record\)\)/);
  assert.match(pino,/safeStartRetryHistory/);
  assert.match(pino,/AUDIT_START_SAFE_RETRY_EXHAUSTED/);
});

test('audit-work restart recovery reuses the current round label and prompt',()=>{
  assert.match(work,/async function recoverDispatchRound\(m,w,round\)/);
  assert.match(work,/\[AUDIT_TOOL,'start',round\.promptPath,round\.label\]/);
  assert.match(work,/if\(\['DISPATCHING','DISPATCH_UNCERTAIN','DISPATCH_FAILED'\]\.includes\(round\.status\)\)return await recoverDispatchRound\(m,w,round\)/);
  assert.match(work,/if\(\['DISPATCHING','DISPATCH_UNCERTAIN','DISPATCH_FAILED'\]\.includes\(w\.status\)\)return await recoverDispatchRound/);
  assert.doesNotMatch(work,/recoverDispatchRound[\s\S]{0,1800}rounds\.push/);
});

test('review-ensure exposes no-write recovery only through durable audit-work and pino state',()=>{
  assert.match(ensure,/function recoverableChatgptStart\(id\)/);
  assert.match(ensure,/canSafeRetryStart\(record\)/);
  assert.match(ensure,/chatgptStartRecoveryEligible/);
  assert.match(ensure,/CHATGPT_SAFE_NO_WRITE_START_RECOVERED/);
  assert.match(ensure,/auditWorkIdFor\(o,c\)/);
});
