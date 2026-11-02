import assert from "node:assert/strict";
import test from "node:test";
import { projectAiDataGrid, type AiDataChangeSetSummary } from "./bo-ai-data-grid";

const base = (id:string,status:AiDataChangeSetSummary["status"],purpose:string,operations:number,submittedAt:string):AiDataChangeSetSummary => ({
  id,status,source:"GPT",purpose,schemaVersion:"v1",planHash:`hash-${id}`,
  preview:{operationCount:operations,destructiveOperationCount:0,destinationTables:[{table:id.includes("term-week")?"term_weeks":"terms",creates:operations}]},
  submittedAt,updatedAt:submittedAt,approvedAt:null,rejectedAt:null,appliedAt:null,version:1,
});
const items=[
  base("pending","PENDING_APPROVAL","Create Term",2,"2026-10-11T10:00:00Z"),
  base("term-week-applying","APPLYING","Apply Term Week",3,"2026-10-11T11:00:00Z"),
  base("unknown","OUTCOME_UNKNOWN","Reconcile Term",1,"2026-10-11T12:00:00Z"),
  base("applied","APPLIED","Completed Term",4,"2026-10-11T13:00:00Z"),
];

test("AI Data grid search/status projection keeps pending and reconcile semantics explicit",()=>{
  const reconcile=projectAiDataGrid(items,{page:1,pageSize:25,search:"",status:"NEEDS_RECONCILE",sort:"updatedAt",direction:"desc"});
  assert.deepEqual(reconcile.items.map((item)=>item.id),["unknown","term-week-applying"]);
  const pending=projectAiDataGrid(items,{page:1,pageSize:25,search:"hash-pending",status:"PENDING_APPROVAL",sort:"updatedAt",direction:"desc"});
  assert.deepEqual(pending.items.map((item)=>item.id),["pending"]);
  const tableSearch=projectAiDataGrid(items,{page:1,pageSize:25,search:"term_weeks",status:"",sort:"updatedAt",direction:"desc"});
  assert.equal(tableSearch.total,1);
  assert.equal(tableSearch.items[0]?.id,"term-week-applying");
});

test("AI Data grid sort/page is deterministic and reconciles stale pages",()=>{
  const byOps=projectAiDataGrid(items,{page:1,pageSize:2,search:"",status:"",sort:"operations",direction:"desc"});
  assert.deepEqual(byOps.items.map((item)=>item.id),["applied","term-week-applying"]);
  const stale=projectAiDataGrid(items,{page:9,pageSize:2,search:"",status:"",sort:"submittedAt",direction:"asc"});
  assert.equal(stale.page,2);
  assert.equal(stale.reconcilePage,2);
  assert.deepEqual(stale.items.map((item)=>item.id),["unknown","applied"]);
});
