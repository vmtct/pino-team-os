import {test} from "node:test";
import assert from "node:assert/strict";
import {hoStaffViewRows,parseHoStaffView} from "./staff-navigation-view";
const rows=[{id:"a",status:"\u0110ang l\u00e0m"},{id:"b",status:"Ng\u01b0ng"},{id:"d",status:"pending"},{id:"u",status:null}];
test("PAP-2423 directory views exclude dossier and unknown states",()=>{
 assert.deepEqual(hoStaffViewRows(rows,"all").map(r=>r.id),["a","b"]);
 assert.deepEqual(hoStaffViewRows(rows,"active").map(r=>r.id),["a"]);
 assert.deepEqual(hoStaffViewRows(rows,"deactivated").map(r=>r.id),["b"]);
 assert.deepEqual(hoStaffViewRows(rows,"register"),[]);
 assert.equal(rows.length,4);
});
test("PAP-2423 activation moves the same record between views",()=>{
 const next=rows.map(r=>r.id==="b"?{...r,status:"\u0110ang l\u00e0m"}:r);
 assert.deepEqual(hoStaffViewRows(next,"active").map(r=>r.id),["a","b"]);
 assert.deepEqual(hoStaffViewRows(next,"deactivated"),[]);
});

test("PAP-2423 only canonical views are accepted",()=>{
 for(const view of ["all","register","active","deactivated"])assert.equal(parseHoStaffView(view),view);
 for(const value of [null,undefined,"unknown",{},["active"]])assert.equal(parseHoStaffView(value),"all");
});
