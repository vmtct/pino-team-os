import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonicalParentRoute} from "../app/bo/parents/parent-route";
import {loadNativeParentContext} from "../app/bo/parents/parent-native-data";
test("PAP-2387 canonical M1-B retains exact synthetic and legacy real navigation hints",()=>{
 assert.equal(canonicalParentRoute({record:"PARENT-MOCK-001"}),"/bo/parents?record=PARENT-MOCK-001");
 assert.equal(canonicalParentRoute({record:"PARENT-MOCK-002",centerId:"01a0b29a-3acd-7a18-a0f2-cf6016548ab5"}),"/bo/parents?centerId=01a0b29a-3acd-7a18-a0f2-cf6016548ab5&record=PARENT-MOCK-002");
 for(const record of ["PARENT-MOCK-1","PARENT-MOCK-001/other","LEAD-MOCK-001","PARENT-MOCK-000000000000000000000000000000"])assert.equal(canonicalParentRoute({record}),null);
});
test("PAP-2387 Staging review uses actual server actor and Center permissions, not local synthetic grants",()=>{
 const page=readFileSync("app/bo/parents/page.tsx","utf8"),entry=readFileSync("app/bo/parents/ParentStagingEntry.tsx","utf8"),native=readFileSync("app/bo/parents/ParentDirectoryDsa.tsx","utf8");
 assert.ok(page.includes('env.APP_ENV!=="staging"'));
 assert.ok(page.includes("await authorizeBoShell"));
 assert.ok(page.includes('actor.permissionKeys.includes("identity.parent_directory.view")'));
 assert.ok(entry.includes("user.email!==actorEmail"));
 assert.ok(entry.includes("center.centers.some(c=>c.id===selected)"));
 assert.ok(entry.includes("loadNativeParentContext(centerId,ctl.signal,fetch,actorId)"));
 assert.ok(entry.includes('canCreate&&grants.has("identity.parent.create")'));
 assert.ok(entry.includes('canEdit&&grants.has("identity.parent.edit")'));
 assert.ok(entry.includes('load:async()=>{throw Error("Parent M1-B has no record transport")'));
 assert.ok(entry.includes("content={<ParentDirectoryDsa/>}"));
 assert.ok(native.includes("fixture?Promise.resolve(fixtureGrants??new Set<string>())"));
 assert.ok(native.includes("centerId={fixture?PARENT_MOCK_CENTER:id}"));
});

test("PAP-2387 scope proof fails closed on actor mismatch, missing grants or wrong Center",async()=>{
 const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5",other="01a0b29a-3acd-7a18-a0f2-cf6016548ab6",signal=new AbortController().signal;
 const seen:string[]=[];const response=(data:unknown)=>new Response(JSON.stringify({data}));
 const make=(userId:string,permissionKeys:string[],centerId:string):typeof fetch=>async(input,options)=>{assert.equal(options?.method,"GET");const url=String(input);seen.push(url);if(url==="/api/bo/context")return response({surface:"BO",entitled:true,userId,permissionKeys});if(url==="/api/bo/centers")return response([{id:centerId,displayName:"Sample"}]);throw Error("unexpected transport");};
 const view=["team.bo.access","identity.parent_directory.view"];
 assert.equal((await loadNativeParentContext(center,signal,make("actor",view,center),"actor")).has("identity.parent.create"),false);
 seen.length=0;await assert.rejects(()=>loadNativeParentContext(center,signal,make("different",view,center),"actor"));assert.deepEqual(seen,["/api/bo/context"]);
 await assert.rejects(()=>loadNativeParentContext(center,signal,make("actor",["team.bo.access"],center),"actor"));
 await assert.rejects(()=>loadNativeParentContext(center,signal,make("actor",view,other),"actor"));
});
