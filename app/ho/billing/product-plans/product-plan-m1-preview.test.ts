// PAP-2183 · synthetic-only M1 contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewState, reducePreview } from "../../../../lib/m1-preview/state";
import { productPlanM1, previewProductPlanUpdate, previewPlanSubscriptions } from "./product-plan-m1-preview";
const seed = productPlanM1.seed;
test("single isolated record, no create or delete, no fake audit", () => {
  const state = createPreviewState(productPlanM1, "local-review");
  assert.equal(state.records.length, 1);
  assert.deepEqual(state.operations, ["replace"]);
  for (const field of ["createdAt","createdBy","updatedAt","updatedBy"] as const) assert.equal(state.records[0][field], null);
  assert.throws(() => reducePreview(state, {type:"remove",id:seed.id}));
});
test("only approved properties change; same identity and audit", () => {
  const next = previewProductPlanUpdate(seed,{name:"  Gói trải nghiệm  ",cadence:2,termWeeks:24,price:2400000,badge:"HERO",enabled:false},1)!;
  assert.deepEqual(next,{...seed,name:"Gói trải nghiệm",cadence:2,termWeeks:24,price:2400000,badge:"HERO",enabled:false,version:2});
  const state = reducePreview(createPreviewState(productPlanM1,"local-review"),{type:"replace",id:seed.id,record:next});
  assert.equal(state.records[0].enabled,false);
  assert.equal(seed.version,1);
});
test("reject stale, invalid and immutable changes", () => {
  for (const patch of [{},{name:" "},{name:123},{name:"x".repeat(121)},{price:-1},{price:2.5},{price:"100"},{badge:"Explore"},{enabled:1},{cadence:0},{cadence:7},{cadence:1.5},{cadence:"2"},{termWeeks:13},{termWeeks:0},{termWeeks:24.5},{termWeeks:"24"},{currency:"USD"},{id:"x"},{updatedBy:"Founder"},{price:100,version:9}]) {
    assert.equal(previewProductPlanUpdate(seed,patch,1),null);
  }
  assert.equal(previewProductPlanUpdate(seed,{price:1},2),null);
  assert.equal(previewProductPlanUpdate({...seed,id:"real-id"},{price:1},1),null);
});

test("Subscription relation uses immutable Product Plan ID, not display name",()=>{
 const related=previewPlanSubscriptions(seed.id);
 assert.equal(related.length,1);
 assert.equal(previewPlanSubscriptions("OTHER").length,0);
 assert.equal(previewPlanSubscriptions(seed.id,[...related,{...related[0],id:"OTHER-SUB",productPlanId:"OTHER"}]).length,1);
 const renamed=previewProductPlanUpdate(seed,{name:"Gói mới",cadence:3,termWeeks:48},seed.version)!;
 assert.deepEqual(previewPlanSubscriptions(renamed.id),related);
});