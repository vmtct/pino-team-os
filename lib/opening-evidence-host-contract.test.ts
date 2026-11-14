import {test} from "node:test";
import assert from "node:assert/strict";
import {openingEvidenceHostDecision as decide} from "./opening-evidence-host-contract";
const id="00000000-0000-7000-8000-000000000001";
void test("PAP-767 exact staging BO entry, detail, review and photo only",()=>{
 const root="/api/bo/opening-evidence",detail=root+"/CLASS/"+id,bo="bo.staging.pinohouse.art";
 for(const [path,method] of [["/bo/opening-evidence","GET"],["/bo/opening-evidence/RECEPTION/"+id,"HEAD"],[root,"GET"],[detail,"GET"],[detail+"/review","POST"],[detail+"/photo/"+id,"GET"]]){
  assert.equal(decide(bo,path!,method!),"next");
  for(const host of ["bo.pinohouse.art","tos.staging.pinohouse.art","ho.staging.pinohouse.art","untrusted.example"])assert.equal(decide(host,path!,method!),"not_found");
 }
 for(const [path,method] of [[root,"POST"],[detail,"PATCH"],[detail+"/review","GET"],[detail+"/photo/"+id,"POST"],[root+"/OTHER/"+id,"GET"],[root+"/CLASS/invalid","GET"],[detail+"/extra","GET"],[detail+"/","GET"]])assert.equal(decide(bo,path!,method!),"not_found");
});
void test("PAP-767 TOS evidence ingress staging-only and strict verbs, unrelated paths unchanged",()=>{
 for(const root of ["/api/workforce/class-opening","/api/workforce/reception/ready"]){
  for(const [suffix,method] of [["","GET"],["","POST"],["/append","POST"],["/photo","GET"]]){
   assert.equal(decide("tos.staging.pinohouse.art",root+suffix,method!),"next");
   assert.equal(decide("tos.pinohouse.art",root+suffix,method!),"not_found");
  }
  assert.equal(decide("tos.staging.pinohouse.art",root+"/append","GET"),"not_found");
  assert.equal(decide("tos.staging.pinohouse.art",root+"/photo","POST"),"not_found");
  assert.equal(decide("tos.staging.pinohouse.art",root+"/bogus","GET"),"not_found");
 }
 assert.equal(decide("tos.pinohouse.art","/api/workforce/schedule","GET"),null);
 assert.equal(decide("bo.staging.pinohouse.art","/bo/payroll-periods","GET"),null);
});
