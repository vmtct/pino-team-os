import assert from "node:assert/strict";
import test from "node:test";
import { canRenderAiDataActions, createLatestRequestGuard, reconciledAiDataPage } from "./bo-ai-data-inbox-lifecycle";

test("detail request guard rejects reordered, closed and not-found stale responses",()=>{
  const guard=createLatestRequestGuard();
  const a=guard.begin("A");
  const b=guard.begin("B");
  assert.equal(guard.isCurrent(a,"B"),false,"late A cannot populate B");
  assert.equal(guard.isCurrent(b,"B"),true);
  guard.invalidate();
  assert.equal(guard.isCurrent(b,"B"),false,"close/not-found invalidates B response");
  const c=guard.begin("C");
  assert.equal(guard.isCurrent(c,"C"),true);
  assert.equal(guard.isCurrent(c,"B"),false);
});

test("Founder actions require exact current selection after detail load",()=>{
  assert.equal(canRenderAiDataActions({selectedId:"B",detailId:"A",detailLoading:false}),false);
  assert.equal(canRenderAiDataActions({selectedId:"B",detailId:"B",detailLoading:true}),false);
  assert.equal(canRenderAiDataActions({selectedId:"",detailId:"B",detailLoading:false}),false);
  assert.equal(canRenderAiDataActions({selectedId:"B",detailId:"B",detailLoading:false}),true);
});

test("page reconciliation waits for successful current list load",()=>{
  assert.equal(reconciledAiDataPage({listReady:false,loading:true,reconcilePage:1}),null,"initial page=2 is preserved while list loads");
  assert.equal(reconciledAiDataPage({listReady:false,loading:false,reconcilePage:1}),null,"failed load cannot rewrite page");
  assert.equal(reconciledAiDataPage({listReady:true,loading:false,reconcilePage:1}),1,"loaded authoritative list may reconcile stale page");
});
