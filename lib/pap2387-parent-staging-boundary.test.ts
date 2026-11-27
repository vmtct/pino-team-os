import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonicalParentRoute} from "../app/bo/parents/parent-route";
import {loadNativeParentContext,loadNativeParentLiveGrants} from "../app/bo/parents/parent-native-data";
import {parentCreateMayEdit} from "../app/bo/parents/parent-create-retry";
test("PAP-2387 live canonical rejects synthetic IDs including legacy links",()=>{
 for(const record of ["PARENT-MOCK-001","PARENT-MOCK-002","PARENT-MOCK-1","PARENT-MOCK-001/other","LEAD-MOCK-001"]){
  assert.equal(canonicalParentRoute({record}),null);assert.equal(canonicalParentRoute({module:"parents",record},true),null);
 }
});
test("PAP-2387 staging mounts scoped live renderer only",()=>{
 const entry=readFileSync("app/bo/parents/ParentStagingEntry.tsx","utf8"),native=readFileSync("app/bo/parents/ParentDirectoryDsa.tsx","utf8"),tabs=readFileSync("app/bo/components/registration/BoParentReadTabs.tsx","utf8"),create=readFileSync("app/bo/parents/ParentCreateDrawer.tsx","utf8");
 assert.ok(entry.includes("loadNativeParentLiveGrants(scope,ctl.signal)"));assert.ok(entry.includes("<ParentLiveScope.Provider value={scope}>"));
 assert.ok(entry.includes("content={<ParentDirectoryDsa/>}"));assert.doesNotMatch(entry,/ParentStagingFixtureProvider|ParentM1Provider|ephemeral:true/);
 assert.ok(native.includes("return loadNativeParentDirectory(centerId,ctl.signal)"));assert.ok(native.includes("liveScope.centerId!==centerId"));
 assert.ok(tabs.includes("new URLSearchParams({centerId:liveScope.centerId})"));
 assert.ok(create.includes("parentCreateMayEdit(previouslyUncertain,true)"));assert.ok(create.includes("if(uncertainRef.current)return"));
});
test("PAP-2387 uncertainty stays locked after preflight or rejection on retry",()=>{
 for(const prior of [false,true])for(const definite of [false,true])assert.equal(parentCreateMayEdit(prior,definite),!prior&&definite);
});
test("PAP-2387 intersect server and fresh scoped grants, reject changed actor or Center",async()=>{
 const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5",other="01a0b29a-3acd-7a18-a0f2-cf6016548ab6",signal=new AbortController().signal;
 const scope={centerId:center,actorId:"actor",canCreate:true,canEdit:false};
 const make=(actor:string,id:string,permissions:string[]):typeof fetch=>async(input,opts)=>{assert.equal(opts?.method,"GET");const url=String(input);const data=url==="/api/bo/context"?{surface:"BO",entitled:true,userId:actor,permissionKeys:permissions}:url==="/api/bo/centers"?[{id,displayName:"Sample"}]:null;assert.ok(data);return new Response(JSON.stringify({data}));};
 const view=["team.bo.access","identity.parent_directory.view"],both=[...view,"identity.parent.create","identity.parent.edit"];
 assert.deepEqual([...(await loadNativeParentLiveGrants(scope,signal,make("actor",center,both)))],["identity.parent.create"]);
 assert.deepEqual([...(await loadNativeParentLiveGrants(scope,signal,make("actor",center,view)))],[]);
 await assert.rejects(()=>loadNativeParentLiveGrants(scope,signal,make("other",center,both)));
 await assert.rejects(()=>loadNativeParentLiveGrants(scope,signal,make("actor",other,both)));
 await assert.rejects(()=>loadNativeParentLiveGrants(scope,signal,make("actor",center,["team.bo.access"])));
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
