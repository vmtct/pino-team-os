import test from "node:test";
import assert from "node:assert/strict";
import {safeTrainingGuideUrl} from "./tos-training-guide-url";
test("PAP-946 only safe absolute HTTP(S) Core training guide links",()=>{
 assert.equal(safeTrainingGuideUrl("https://docs.example.com/training"),"https://docs.example.com/training");
 for(const value of ["javascript:alert(1)","data:text/html,a","/relative","file:///tmp/a","https://user:pass@example.com/x",""]){
  assert.equal(safeTrainingGuideUrl(value),null,value);
 }
});
