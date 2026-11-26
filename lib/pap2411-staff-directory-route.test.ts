import test from "node:test";
import assert from "node:assert/strict";
import {canonicalStaffDirectoryRoute,STAFF_DIRECTORY_ROUTE as path} from "../app/bo/workforce/staffs/staff-directory-route";
import {currentBoModuleHref} from "./bo-url-contract";
import {safeBoStagingReturnTo} from "./bo-staging-return-to";
import {decideHostBoundary,BO_STAGING_HOSTNAME} from "./host-boundary";
const id="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
test("PAP-2411 exact canonical Staff alias and deep-link hints",()=>{
  const expected=path+"?centerId="+center+"&view=active&record="+id;
  assert.equal(canonicalStaffDirectoryRoute({module:"staffs",record:id,centerId:center,view:"active"},true),expected);
  assert.equal(safeBoStagingReturnTo("/bo?module=staffs&record="+id+"&centerId="+center+"&view=active"),expected);
  assert.equal(safeBoStagingReturnTo(expected),expected);
  assert.equal(currentBoModuleHref("staffs",{}),path);
  for(const query of [{record:["x","y"]},{centerId:"/other"},{view:"unknown"},{module:"staffs"},{m1Preview:"1"}]) assert.equal(canonicalStaffDirectoryRoute(query),null);
});
test("PAP-2411 exact Staging GET/HEAD admission only",()=>{
  for(const method of ["GET","HEAD"])assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME,path,method).action,"next");
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art"])assert.equal(decideHostBoundary(host,path).action,"not_found");
  for(const invalid of [path+"/extra",path.replace("staffs","Staffs")])assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME,invalid).action,"not_found");
  assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME,path,"POST").action,"not_found");
});
