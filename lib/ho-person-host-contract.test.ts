import {test} from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary} from "./host-boundary";
import {safeHoReturnTo,HO_PAGE_PATHS} from "./ho-routes";
const ho="ho.staging.pinohouse.art",page="/ho/system/people",api="/api/ho/identity/persons",id="019d2170-0000-7000-8000-000000000001";
test("PAP-2180 exact staging HO page and read-only API, deny all other hosts and verbs",()=>{
 for(const p of [page,api,api+"/"+id,api+"/unlinked-counts"])assert.equal(decideHostBoundary(ho,p,"GET").action,"next");
 for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","bo.pinohouse.art","tos.pinohouse.art"])
 for(const p of [page,api,api+"/"+id,api+"/unlinked-counts"])assert.equal(decideHostBoundary(h,p,"GET").action,"not_found");
 for(const p of [page,api,api+"/"+id,api+"/unlinked-counts"])
 for(const m of ["POST","PATCH","PUT","DELETE"])assert.equal(decideHostBoundary(ho,p,m).action,"not_found");
 for(const p of [api+"/bad",api+"/"+id+"/extra",api.toUpperCase(),api+"/","/api/bo/identity/persons","/api/tos/identity/persons"])assert.equal(decideHostBoundary(ho,p,"GET").action,"not_found");
 assert.equal(HO_PAGE_PATHS.people,page);assert.equal(safeHoReturnTo(page+"?record="+id),page+"?record="+id);
 assert.equal(decideHostBoundary(ho,"/ho/mytime-workshops","GET").action,"next");
});
