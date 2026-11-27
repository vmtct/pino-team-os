import test from "node:test";
import assert from "node:assert/strict";
import {applyAccountInlineSample,type AccountInlineSample,type AccountInlineField} from "./staff-account-inline-sample";
import type {RoleChoice} from "./staff-access-presentation-model";
const roles:RoleChoice[]=[{id:"r",label:"R",active:true,protected:false,scopes:["CENTER"]},{id:"r2",label:"R2",active:true,protected:false,scopes:["CENTER"]},{id:"protected",label:"Protected",active:true,protected:true,scopes:["CENTER"]}];
const centers=[{id:"c",label:"C",active:true}];
const seed:AccountInlineSample={loginEmail:"staff@example.invalid",snapshot:{staffId:"STAFF-MOCK-001",accountId:"M1-HYPOTHETICAL-ACCOUNT:STAFF-MOCK-001",accountStatus:"inactive",employment:"inactive",revision:1,affiliationIds:["c"],assignments:[]}};
function apply(s:AccountInlineSample,field:AccountInlineField,value:unknown,revision=s.snapshot.revision){return applyAccountInlineSample(s,{staffId:s.snapshot.staffId,accountId:s.snapshot.accountId,revision,field,value},roles,centers,[])}
test("PAP-784 activate/edit/deactivate only linked synthetic account; preserve employment and scope",()=>{
 const active=apply(seed,"accountStatus","active");assert.ok(active);assert.equal(active.snapshot.employment,"inactive");assert.deepEqual(active.snapshot.assignments,[]);assert.equal(active.snapshot.revision,2);
 const edited=apply(active,"loginEmail","new@example.invalid");assert.ok(edited);assert.equal(edited.loginEmail,"new@example.invalid");assert.equal(apply(edited,"loginEmail","real@example.com"),null);assert.equal(apply(edited,"accountStatus","inactive",1),null);
 const inactive=apply(edited,"accountStatus","inactive");assert.ok(inactive);assert.equal(inactive.snapshot.accountStatus,"inactive");assert.deepEqual(inactive.snapshot.affiliationIds,seed.snapshot.affiliationIds);
 assert.equal(apply({...seed,snapshot:{...seed.snapshot,accountId:"real"}},"accountStatus","active"),null);
});
test("PAP-784 inline role replacement preserves exact existing scope, rejects ambiguous/protected/inactive",()=>{
 const a={id:"a",roleId:"r",scope:{type:"CENTER" as const,id:"c"},protected:false};
 const s:AccountInlineSample={...seed,snapshot:{...seed.snapshot,accountStatus:"active",assignments:[a]}};
 const changed=apply(s,"role","r2");assert.ok(changed);assert.deepEqual(changed.snapshot.assignments,[{...a,roleId:"r2"}]);
 assert.equal(apply(s,"role","protected"),null);assert.equal(apply(seed,"role","r2"),null);
 assert.equal(apply({...s,snapshot:{...s.snapshot,assignments:[a,{...a,id:"b"}]}},"role","r2"),null);
 assert.equal(apply({...s,snapshot:{...s.snapshot,assignments:[{...a,protected:true}]}},"accountStatus","inactive"),null);
});
