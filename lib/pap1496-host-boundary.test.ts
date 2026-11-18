/** PAP-1496 / PAP-1491 — authenticated BO Subscription Specialty exact host ingress. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";

const subscriptionId="019a0f22-1111-7111-8111-000000000005";
const grantId="019a0f22-1111-7111-8111-000000000008";
const base="/api/bo/subscriptions/"+subscriptionId;
const list=base+"/specialties";
const detail=list+"/"+grantId;
const grant=base+"/specialty-grants";
const complete=grant+"/"+grantId+"/completion";
const next={action:"next"};
const missing={action:"not_found"};

test("PAP-1496 BO Staging admits exactly 4 Subscription Specialty method+route pairs",()=>{
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",list,"GET"),next);
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",detail,"GET"),next);
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",grant,"POST"),next);
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",complete,"PATCH"),next);
});
test("PAP-1496 denies wrong method even with exact path",()=>{
 for(const [path,valid] of [[list,"GET"],[detail,"GET"],[grant,"POST"],[complete,"PATCH"]] as const){
  for(const method of ["GET","POST","PATCH","PUT","DELETE","HEAD"]){
   if(method!==valid)assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),missing,path+" "+method);
  }
 }
});
test("PAP-1496 refuses BO production, HO, TOS and non-BO staging hosts",()=>{
 for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art",
  "staff.pinohouse.art","evil.bo.staging.pinohouse.art"]){
  for(const [path,method] of [[list,"GET"],[detail,"GET"],[grant,"POST"],[complete,"PATCH"]] as const)
   assert.deepEqual(decideHostBoundary(host,path,method),missing,host+" "+path);
 }
});
test("PAP-1496 denies malformed, arbitrary, nested, legacy and wildcard descendants",()=>{
 for(const path of [
  base+"/specialties/",base+"/specialties/history",base+"/specialties/all",
  base+"/specialty-grants/",grant+"/"+grantId,grant+"/"+grantId+"/revoke",
  grant+"/"+grantId+"/completion/history",grant+"/malformed/completion",
  "/api/bo/subscriptions/not-a-uuid/specialties",
  "/api/bo/students/"+subscriptionId+"/specialties",
  "/api/bo/subscriptions/"+subscriptionId+"/specialties/extra",
 ]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,"GET"),missing,path);
 }
});

test("PAP-1035 exact Enrollment host and verbs only",()=>{
 const routes=[["list","GET"],["placement","GET"],["capacity","GET"],["attach","POST"],["transfer/"+grantId,"POST"]] as const;
 for(const [suffix,verb] of routes){
  const path=base+"/enrollment/"+suffix;
  for(const host of ["bo.staging.pinohouse.art","bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","unknown.example"]){
   for(const method of ["GET","POST","HEAD","PATCH","PUT","DELETE"]){
    assert.deepEqual(decideHostBoundary(host,path,method),host==="bo.staging.pinohouse.art"&&method===verb?next:missing);
   }
  }
 }
 for(const suffix of ["","end","bulk-place","transfer/invalid","transfer/"+grantId+"/end","list/extra","attach/"]){
  for(const method of ["GET","POST"])assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",base+"/enrollment/"+suffix,method),missing);
 }
});
