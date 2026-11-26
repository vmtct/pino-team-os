import test from "node:test";
import assert from "node:assert/strict";
import {RUNNING_CLASS_LIVE_ADMISSION,parseRunningClassLiveQuery,parseRunningClassStageQuery} from "./running-class-stage-admission";
const center="01234567-89ab-7abc-8def-000000000001",record="01234567-89ab-7abc-8def-000000000002",path="/bo/running-classes";
const p=(s:string)=>new URLSearchParams(s);
test("live mode accepts only canonical Center and record, normalizes legacy alias without granting access",()=>{
 assert.equal(parseRunningClassLiveQuery(p("")),path);
 assert.equal(parseRunningClassLiveQuery(p("record="+record+"&centerId="+center+"&utm_source=test")),path+"?centerId="+center+"&record="+record);
 assert.equal(parseRunningClassLiveQuery(p("module=classes&record="+record),true),path+"?record="+record);
 for(const q of ["record=RUNNING-CLASS-MOCK-001","m1Preview=1","record="+record+"&record="+record,"centerId=bad","record="+record.toUpperCase(),"tab=history","module=classes"])assert.equal(parseRunningClassLiveQuery(p(q)),null,q);
});
test("current server phase keeps approved M1, real IDs and selectors not admitted",()=>{
 assert.equal(RUNNING_CLASS_LIVE_ADMISSION,false);
 assert.equal(parseRunningClassStageQuery(p("record=RUNNING-CLASS-MOCK-001")),path+"?record=RUNNING-CLASS-MOCK-001");
 assert.equal(parseRunningClassStageQuery(p("record="+record)),null);
 assert.equal(parseRunningClassStageQuery(p("m1Preview=1")),null);
});
