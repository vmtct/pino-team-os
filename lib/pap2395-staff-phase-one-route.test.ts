import test from "node:test";
import assert from "node:assert/strict";
import {STAFF_PHASE_ONE_ENABLED,staffPhaseOneRoute,parseStaffPhaseOneQuery,invalidStaffPhaseOneRequest} from "../app/ho/staff/staff-phase-one-route";
import {safeHoReturnTo} from "./ho-routes";
const host="ho.staging.pinohouse.art",id="019a0000-0000-7000-8000-000000000003";
test("PAP-2395 phase1 enabled after official MIG-0210 readback, only Staging",()=>{
 assert.equal(STAFF_PHASE_ONE_ENABLED,true);
 assert.equal(staffPhaseOneRoute("staging",host,{}),"native");
 assert.equal(staffPhaseOneRoute("staging",host,{record:id}),"native");
 assert.equal(staffPhaseOneRoute("staging",host,{record:id},false),"disabled");
 assert.equal(staffPhaseOneRoute("production",host,{}),"disabled");
});
test("PAP-2395 native canonical route accepts only staging HO and real record state",()=>{
 for(const query of [{},{record:id},{record:id,utm_source:"chatgpt.com"}])assert.equal(staffPhaseOneRoute("staging",host,query,true),"native");
 for(const query of [{record:"STAFF-MOCK-001"},{record:""},{record:[id,id]},{record:id,m1Preview:"1"},{m1Preview:"1"},{record:"019a0000-0000-4000-8000-000000000003"},{record:id,centerId:id},{record:id,tab:"unknown"},{next:"//evil.example"}])assert.equal(staffPhaseOneRoute("staging",host,query,true),"invalid");
 for(const [env,h] of [["production",host],["staging","bo.staging.pinohouse.art"],["staging","ho.pinohouse.art"],["staging",host+".evil.example"]])assert.equal(staffPhaseOneRoute(env,h,{},true),"disabled");
 assert.equal(safeHoReturnTo("/ho/staff?record="+id+"&utm_source=chatgpt.com"),"/ho/staff?record="+id);
 assert.equal(safeHoReturnTo("/ho/staff?record="+id+"&record="+id),null);
});
test("PAP-2395 URL and page query shapes share canonical record-only parsing",()=>{
 assert.deepEqual(parseStaffPhaseOneQuery(new URLSearchParams()),{record:null});
 assert.deepEqual(parseStaffPhaseOneQuery(new URLSearchParams("record="+id+"&utm_source=chatgpt.com")),{record:id});
 assert.deepEqual(parseStaffPhaseOneQuery({record:id}),{record:id});
 for(const query of ["record="+id+"&record="+id,"m1Preview=1","record=STAFF-MOCK-001","record="+id+"&tab=overview","record="+id+"&returnTo=%2F%2Fevil.example","record=","_rsc=abc"])assert.equal(parseStaffPhaseOneQuery(new URLSearchParams(query)),null,query);
});

test("PAP-2395 pre-stream policy is exact host/path/verb and only strips internal RSC transport",()=>{
 const check=(query:string,rsc:string|null=null,enabled=true,hostname=host,path="/ho/staff",method="GET")=>invalidStaffPhaseOneRequest(hostname,path,method,new URLSearchParams(query),rsc,enabled);
 for(const q of ["m1Preview=1","record=STAFF-MOCK-001","record="+id+"&record="+id,"record="+id+"&next=/bo","_rsc=abc"])assert(check(q));
 assert(!check("record="+id));assert(!check("record="+id+"&_rsc=abc","1"));
 assert(check("record=STAFF-MOCK-001&_rsc=abc","1"));
 assert(!check("m1Preview=1",null,false));
 assert(!check("m1Preview=1",null,true,"bo.staging.pinohouse.art"));
 assert(!check("m1Preview=1",null,true,host,"/ho/centers"));
 assert(!check("m1Preview=1",null,true,host,"/ho/staff","POST"));
 assert(check("m1Preview=1",null,true,host,"/ho/staff","HEAD"));
});
