import test from "node:test";
import assert from "node:assert/strict";
import {receptionHandoverBoundary} from "./tos-reception-handover-boundary";
const p="pinoria/house/pickup-options",w="pinoria/house/verified-check-out",q="centerId=a&studentProfileId=b&expectedVisitId=c&expectedVersion=1";
test("PAP-2431 exact pickup query and verb admission",()=>{
 assert.equal(receptionHandoverBoundary("GET",p,new URLSearchParams(q)),null);
 for(const query of [q+"&centerId=a",q+"&t=1",q+"&staffId=x",q.replace("expectedVersion=1","expectedVersion="),"centerId=a"])assert.equal(receptionHandoverBoundary("GET",p,new URLSearchParams(query)),400);
 assert.equal(receptionHandoverBoundary("POST",p,new URLSearchParams(q)),405);
 for(const path of [w,"pinoria/house/check-out"]){
  assert.equal(receptionHandoverBoundary("POST",path,new URLSearchParams()),null);
  assert.equal(receptionHandoverBoundary("POST",path,new URLSearchParams("centerId=a")),400);
  assert.equal(receptionHandoverBoundary("GET",path,new URLSearchParams()),405);
 }
 assert.equal(receptionHandoverBoundary("GET","learning/mission-assignments",new URLSearchParams("centerId=a&t=1")),null);
});
