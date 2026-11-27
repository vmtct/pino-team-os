import {authorizedTabs} from "@/lib/workspace-schema";
import {personSchema,personPreviewSchema,READ,VIEW_AS} from "./schema";
import {test} from "node:test";
import assert from "node:assert/strict";
import {createSupportPreviewPerson,previewRemainingSeconds,startSupportPreview,SUPPORT_FIXTURE_ID,SUPPORT_PREVIEW_TTL_MS} from "./person-support-preview";
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

test("PAP-1523 preview-only View as tab, native ordering and scoped permission",()=>{
 const ctx={surface:"HO" as const,authorize:(key:string)=>key===READ||key===VIEW_AS};
 const denied={surface:"HO" as const,authorize:(key:string)=>key===READ};
 assert.deepEqual(authorizedTabs(personSchema,ctx).map(t=>t.id),["overview","history"]);
 assert.deepEqual(authorizedTabs(personPreviewSchema,ctx).map(t=>t.id),["overview","view-as","history"]);
 assert.deepEqual(authorizedTabs(personPreviewSchema,denied).map(t=>t.id),["overview","history"]);
 assert.deepEqual(authorizedTabs(personPreviewSchema,{surface:"BO",centerId:"qa",authorize:()=>true}),[]);
});

test("PAP-1523 reusable fixture is one isolated synthetic Person with null audit provenance",()=>{
 const row=createSupportPreviewPerson(),other=createSupportPreviewPerson();
 assert.equal(row.id,SUPPORT_FIXTURE_ID);
 assert.equal(row.name,"Person QA Synthetic");
 assert.deepEqual(row.roles,["Student","Staff","Parent","MyTime Guest"]);
 assert.equal(row.avatarId,null);
 for(const value of [row.createdAt,row.createdBy,row.updatedAt,row.updatedBy])assert.equal(value,null);
 assert.notEqual(row,other);
 assert.notEqual(row.roles,other.roles);
});