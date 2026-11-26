import test from "node:test";
import assert from "node:assert/strict";
import {STAFF_PHASE_ONE_ENABLED,staffPhaseOneRoute} from "../app/ho/staff/staff-phase-one-route";
import {safeHoReturnTo} from "./ho-routes";
const host="ho.staging.pinohouse.art",id="019a0000-0000-7000-8000-000000000003";
test("PAP-2395 phase1 deployment switch remains off until Core readback",()=>{
 assert.equal(STAFF_PHASE_ONE_ENABLED,false);
 assert.equal(staffPhaseOneRoute("staging",host,{}),"disabled");
 assert.equal(staffPhaseOneRoute("staging",host,{record:id}),"disabled");
});
test("PAP-2395 native canonical route accepts only staging HO and real record state",()=>{
 for(const query of [{},{record:id},{record:id,utm_source:"chatgpt.com"}])assert.equal(staffPhaseOneRoute("staging",host,query,true),"native");
 for(const query of [{record:"STAFF-MOCK-001"},{record:""},{record:[id,id]},{record:id,m1Preview:"1"},{m1Preview:"1"},{record:"019a0000-0000-4000-8000-000000000003"},{record:id,centerId:id},{record:id,tab:"unknown"},{next:"//evil.example"}])assert.equal(staffPhaseOneRoute("staging",host,query,true),"invalid");
 for(const [env,h] of [["production",host],["staging","bo.staging.pinohouse.art"],["staging","ho.pinohouse.art"],["staging",host+".evil.example"]])assert.equal(staffPhaseOneRoute(env,h,{},true),"disabled");
 assert.equal(safeHoReturnTo("/ho/staff?record="+id+"&utm_source=chatgpt.com"),"/ho/staff?record="+id);
 assert.equal(safeHoReturnTo("/ho/staff?record="+id+"&record="+id),null);
});