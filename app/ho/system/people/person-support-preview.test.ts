import {test} from "node:test";
import assert from "node:assert/strict";
import {previewRemainingSeconds,startSupportPreview,SUPPORT_FIXTURE_ID,SUPPORT_PREVIEW_TTL_MS} from "./person-support-preview";
test("PAP-1523 fixture-only VIEW targets, reason, expiry",()=>{
 const at=1000;
 for(const id of ["student","parent","staff","manager"]){
  const session=startSupportPreview(SUPPORT_FIXTURE_ID,id,"QA view",at);
  assert.ok(session);
  assert.equal(session.personId,SUPPORT_FIXTURE_ID);
  assert.equal(session.expiresAt,at+SUPPORT_PREVIEW_TTL_MS);
  assert.equal(previewRemainingSeconds(session,at),900);
  assert.equal(previewRemainingSeconds(session,session.expiresAt),0);
  assert.equal(previewRemainingSeconds(session,session.expiresAt+1000),0);
 }
 for(const target of ["guest","founder","ACT","missing"])assert.equal(startSupportPreview(SUPPORT_FIXTURE_ID,target,"QA",at),null);
 for(const reason of ["","  ","x".repeat(501)])assert.equal(startSupportPreview(SUPPORT_FIXTURE_ID,"parent",reason,at),null);
 assert.equal(startSupportPreview("real-person","parent","QA",at),null);
 assert.equal(startSupportPreview(SUPPORT_FIXTURE_ID,"parent","QA",NaN),null);
});
