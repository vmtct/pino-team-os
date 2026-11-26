import test from "node:test";
import assert from "node:assert/strict";
import {createStaffCenterRegistrationM1Service,STAFF_M1_CENTER as center} from "../app/bo/workforce/staffs/staff-center-registration-m1-service";
const signal=new AbortController().signal;
test("PAP-2411 Manager fixture exact Center, CAS and replay",async()=>{
 const s=createStaffCenterRegistrationM1Service();const [row]=await s.list(center,signal);const [role]=await s.roles(center,signal);
 await assert.rejects(s.list("real-center",signal));
 const body={expectedVersion:row.version,assignments:[{roleId:role.id,scopeType:"CENTER",scopeId:center}],pinoriaIdentity:{mode:"CREATE_STAFF_ONLY_PERSON"}};
 await assert.rejects(s.review(center,row.id,"approve",{...body,expectedVersion:2},"bad"));
 await assert.rejects(s.review(center,row.id,"approve",{...body,assignments:[{...body.assignments[0],scopeId:"real-center"}]},"bad"));
 const result=await s.review(center,row.id,"approve",body,"ok");
 assert.deepEqual(await s.review(center,row.id,"approve",body,"ok"),result);assert.equal((await s.list(center,signal)).length,0);
 await assert.rejects(s.review(center,row.id,"reject",{expectedVersion:1,reason:"test"},"ok"));
});
test("PAP-2411 Manager reject leaves independent fixture untouched",async()=>{
 const a=createStaffCenterRegistrationM1Service(),b=createStaffCenterRegistrationM1Service();const [row]=await a.list(center,signal);
 await assert.rejects(a.review(center,row.id,"reject",{expectedVersion:1,reason:" "},"bad"));
 assert.equal((await a.review(center,row.id,"reject",{expectedVersion:1,reason:"test"},"r")).status,"REJECTED");assert.equal((await b.list(center,signal)).length,1);
});
