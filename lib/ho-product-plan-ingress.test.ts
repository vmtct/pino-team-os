import test from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary,HO_STAGING_HOSTNAME} from "./host-boundary";
import {catalogPath} from "../app/ho/billing/product-plans/product-plan-native-contract";
test("PAP-2365 exact HO staging catalog ingress and method fence",()=>{
 const id="01900000-0000-7000-8000-000000000001",detail=catalogPath+"/"+id;
 for(const [path,method] of [[catalogPath,"GET"],[detail,"GET"],[detail,"PATCH"],[detail+"/subscriptions","GET"],[detail+"/history","GET"]]){
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,path,method).action,"next");
  for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","localhost"])assert.equal(decideHostBoundary(host,path,method).action,"not_found");
 }
 for(const [path,method] of [[catalogPath,"PATCH"],[detail,"DELETE"],[detail+"/history","PATCH"],[detail+"/extra","GET"],[catalogPath+"/PRODUCT-PLAN-MOCK-001","GET"],[catalogPath.toUpperCase(),"GET"]])assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,path,method).action,"not_found");
});
