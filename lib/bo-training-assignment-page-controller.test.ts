import test from "node:test";
import assert from "node:assert/strict";
import { BO_TRAINING_ASSIGNMENTS_MAX_OFFSET, loadBoTrainingAssignmentPageForState } from "./bo-training-assignment-page-controller";
import type { TrainingAssignmentBrowsePage } from "./training-model";

const empty = (limit:number,offset:number,total:number):TrainingAssignmentBrowsePage => ({ items: [], page: { limit, offset, total, page: Math.floor(offset/limit)+1, pageCount: total?Math.ceil(total/limit):0, hasPrevious: offset>0, hasNext: offset+limit<total } });

test("training assignment page controller uses bounded server offset and forwards browse state", async () => {
  let seen: unknown;
  const result = await loadBoTrainingAssignmentPageForState({ page: 2, pageSize: 25, search: "Hằng", status: "COMPLETION_PENDING", sort: "staff", direction: "asc" }, async (input) => { seen=input; return empty(input.limit,input.offset,80); });
  assert.equal(result.kind,"ready");
  assert.deepEqual(seen,{limit:25,offset:25,query:"Hằng",status:"COMPLETION_PENDING",sort:"staff",direction:"asc"});
});

test("training assignment page controller reconciles impossible and stale pages before invalid offset loops", async () => {
  let calls=0;
  const impossible=Math.floor(BO_TRAINING_ASSIGNMENTS_MAX_OFFSET/100)+2;
  const bounded=await loadBoTrainingAssignmentPageForState({page:impossible,pageSize:100,search:"",status:"",sort:"updatedAt",direction:"desc"},async()=>{calls++;return empty(100,0,0);});
  assert.deepEqual(bounded,{kind:"reconcile-page",page:Math.floor(BO_TRAINING_ASSIGNMENTS_MAX_OFFSET/100)+1});
  assert.equal(calls,0);
  const stale=await loadBoTrainingAssignmentPageForState({page:9,pageSize:25,search:"",status:"",sort:"updatedAt",direction:"desc"},async(input)=>{calls++;return empty(input.limit,input.offset,51);});
  assert.deepEqual(stale,{kind:"reconcile-page",page:3});
  assert.equal(calls,1);
});
