import test from "node:test";
import assert from "node:assert/strict";
import { assignmentReady, WALKIN_PATHS, selectedPassMatchesCenter, canCopyAssignedPassCode, acceptInventoryResponse } from "./open-studio-walkin-ui-contract";

test("the Founder-approved Path values are exact and explicit",()=>{
 assert.deepEqual(WALKIN_PATHS,["AC","LPP","LPA","PH"]);
});
test("Parent+Center+Path all required; never issue when busy",()=>{
 for(const path of WALKIN_PATHS)assert.equal(assignmentReady("parent",""+path,"center",false),true);
 for(const values of [["","AC","center",false],["parent","","center",false],["parent","ZZ","center",false],["parent","AC","",false],["parent","AC","center",true]] as const)
  assert.equal(assignmentReady(values[0],values[1],values[2],values[3]),false,JSON.stringify(values));
});

test("Center mismatch and missing scope deny stale Pass operations",()=>{
 const valid={center_id:"center-a",status:"ASSIGNED"};
 assert.equal(selectedPassMatchesCenter(valid,"center-a"),true);
 assert.equal(canCopyAssignedPassCode(valid,"center-a"),true);
 assert.equal(selectedPassMatchesCenter(valid,"center-b"),false);
 assert.equal(canCopyAssignedPassCode(valid,"center-b"),false);
 assert.equal(canCopyAssignedPassCode({...valid,status:"CONSUMED"},"center-a"),false);
 assert.equal(canCopyAssignedPassCode({...valid,status:"REVOKED"},"center-a"),false);
 assert.equal(canCopyAssignedPassCode({...valid,status:"AVAILABLE"},"center-a"),false);
 assert.equal(selectedPassMatchesCenter({...valid,center_id:null},"center-a"),false);
 assert.equal(selectedPassMatchesCenter(valid,""),false);
 assert.equal(selectedPassMatchesCenter(null,"center-a"),false);
});
test("responses from stale or changed Center are never accepted",()=>{
 assert.equal(acceptInventoryResponse(2,2,"center-a","center-a"),true);
 assert.equal(acceptInventoryResponse(1,2,"center-a","center-a"),false);
 assert.equal(acceptInventoryResponse(2,2,"center-a","center-b"),false);
 assert.equal(acceptInventoryResponse(2,2,"",""),false);
});
