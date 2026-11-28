import assert from "node:assert/strict";
import test from "node:test";
import {parseStaffLocalRoute,staffLocalRouteSearch,staffLocalTabs,STAFF_LOCAL_RECORD} from "./staff-local-route-state";
const parse=(q:string)=>parseStaffLocalRoute(new URLSearchParams(q));
test("PAP-2347 exact pinned Staff record, drawer and detail tab roundtrip",()=>{
 assert.deepEqual(parse(""),{kind:"table",tab:"overview"});
 assert.deepEqual(parse("record="+STAFF_LOCAL_RECORD),{kind:"drawer",recordId:STAFF_LOCAL_RECORD,tab:"overview"});
 for(const tab of staffLocalTabs){const state={kind:"detail",recordId:STAFF_LOCAL_RECORD,tab} as const;assert.deepEqual(parse(staffLocalRouteSearch(state)),state);}
 assert.equal(staffLocalRouteSearch({kind:"table",tab:"overview"}),"");
 assert.equal(staffLocalRouteSearch({kind:"detail",recordId:"STAFF-MOCK-002",tab:"access"}),"");
 assert.throws(()=>staffLocalRouteSearch({kind:"detail",recordId:STAFF_LOCAL_RECORD,tab:"unknown"}));
});
test("PAP-2347 reject unknown, duplicate, non-pinned or inconsistent route state",()=>{
 for(const q of ["surface=detail","record=STAFF-MOCK-002","record=STAFF-MOCK-001&tab=access","record=STAFF-MOCK-001&surface=drawer","record=STAFF-MOCK-001&surface=detail&tab=unknown","record=STAFF-MOCK-001&surface=detail&tab=","record=STAFF-MOCK-001&surface=detail&tab=access&tab=history","record=STAFF-MOCK-001&record=STAFF-MOCK-001","record=STAFF-MOCK-001&surface=detail&surface=detail","record=STAFF-MOCK-001&view=register","m1Preview=1"])assert.equal(parse(q),null,q);
});
