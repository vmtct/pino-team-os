import test from "node:test";
import assert from "node:assert/strict";
import { assignmentReady, WALKIN_PATHS } from "./open-studio-walkin-ui-contract";

test("the Founder-approved Path values are exact and explicit",()=>{
 assert.deepEqual(WALKIN_PATHS,["AC","LPP","LPA","PH"]);
});
test("Parent+Center+Path all required; never issue when busy",()=>{
 for(const path of WALKIN_PATHS)assert.equal(assignmentReady("parent",""+path,"center",false),true);
 for(const values of [["","AC","center",false],["parent","","center",false],["parent","ZZ","center",false],["parent","AC","",false],["parent","AC","center",true]] as const)
  assert.equal(assignmentReady(values[0],values[1],values[2],values[3]),false,JSON.stringify(values));
});
