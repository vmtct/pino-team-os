import {test} from "node:test";
import assert from "node:assert/strict";
import {resolveLegacyLeadIntent} from "../app/bo/sales/leads/legacy-lead-intent-resolution";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";
const actor="01a03c6e-cc58-7d81-ac8e-123456789abc",intent="01a03c6e-cc58-7d81-ac8e-123456789abd",lead="01a03c6e-cc58-7d81-ac8e-123456789abe";
const credential={kind:"password",token:"synthetic"} as const;
const context={userId:actor,surface:"BO",entitled:true,permissionKeys:["acquisition.lead.manage"]};
function fixture(overrides:Record<string,{status:number;data:unknown}>={}){
 const calls:BoAccessRequest[]=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(req,token){
  assert.equal(token,"synthetic");calls.push(req);
  const value=overrides[req.path]??{status:200,data:req.path==="context"?context:req.path==="acquisition/intents/"+intent?{id:intent,leadId:lead,phone:"synthetic-private"}:{id:lead,phone:"synthetic-private"}};
  return {status:value.status,body:{data:value.data},requestId:"synthetic"};
 }};
 return {binding,calls};
}
test("PAP-2288 F1 authorized exact intent resolves only canonical household navigation",async()=>{
 const {binding,calls}=fixture();
 const result=await resolveLegacyLeadIntent(binding,credential,actor,intent);
 assert.deepEqual(result,{status:200,leadId:lead,href:"/bo/sales/leads?lead="+lead+"&tab=history"});
 assert.deepEqual(calls,["context","acquisition/intents/"+intent,"acquisition/households/"+lead].map(path=>({method:"GET",path})));
 assert.ok(!JSON.stringify(result).includes("private"));
});
test("PAP-2288 F1 cannot turn visible child intent into denied household access",async()=>{
 for(const status of [401,403,404,500]){
  const {binding,calls}=fixture({["acquisition/households/"+lead]:{status,data:null}});
  assert.deepEqual(await resolveLegacyLeadIntent(binding,credential,actor,intent),{status:status===500?503:status});
  assert.equal(calls.length,3);
 }
});
test("PAP-2288 F1 mismatch or invalid session stops before domain read",async()=>{
 for(const data of [{...context,userId:lead},{...context,permissionKeys:[]},{...context,entitled:false}]){
  const {binding,calls}=fixture({context:{status:200,data}});
  assert.deepEqual(await resolveLegacyLeadIntent(binding,credential,actor,intent),{status:403});
  assert.equal(calls.length,1);
 }
 const {binding,calls}=fixture();
 assert.deepEqual(await resolveLegacyLeadIntent(binding,credential,actor,"LEAD-MOCK-001"),{status:400});
 assert.deepEqual(await resolveLegacyLeadIntent(binding,{kind:"support",token:"synthetic"},actor,intent),{status:403});
 assert.equal(calls.length,0);
});
test("PAP-2288 malformed or mismatched canonical response is never redirected",async()=>{
 for(const data of [{id:actor,leadId:lead},{id:intent,leadId:"LEAD-MOCK-001"}]){
  const {binding,calls}=fixture({["acquisition/intents/"+intent]:{status:200,data}});
  assert.deepEqual(await resolveLegacyLeadIntent(binding,credential,actor,intent),{status:503});
  assert.equal(calls.length,2);
 }
 const {binding}=fixture({["acquisition/households/"+lead]:{status:200,data:{id:actor}}});
 assert.deepEqual(await resolveLegacyLeadIntent(binding,credential,actor,intent),{status:503});
});
