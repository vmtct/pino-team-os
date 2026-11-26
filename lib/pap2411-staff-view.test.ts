import test from "node:test";
import assert from "node:assert/strict";
import {parseStaffsView, staffDirectoryViewHref, staffsViewRows} from "../app/bo/components/registration/BoStaffsViews";
const path="/bo/workforce/staffs";
test("PAP-2411 view navigation retains Center and clears unrelated record",()=>{
  assert.equal(parseStaffsView("register"),"register");
  assert.equal(parseStaffsView("garbage"),"all");
  assert.equal(staffDirectoryViewHref(path,"?centerId=center&record=old&tab=history&surface=detail","active"),path+"?centerId=center&view=active");
  assert.equal(staffDirectoryViewHref(path,"?centerId=center&view=register","all"),path+"?centerId=center");
});
test("PAP-2411 never treats registration as directory rows",()=>{
  const rows=[{id:"1",name:"A",status:"active"},{id:"2",name:"B",status:"inactive"},{id:"3",name:"C",status:"pending"}];
  assert.deepEqual(staffsViewRows(rows,"all").map(r=>r.id),["1","2"]);
  assert.deepEqual(staffsViewRows(rows,"register"),[]);
  assert.deepEqual(staffsViewRows(rows,"active").map(r=>r.id),["1"]);
  assert.deepEqual(staffsViewRows(rows,"deactivated").map(r=>r.id),["2"]);
});
