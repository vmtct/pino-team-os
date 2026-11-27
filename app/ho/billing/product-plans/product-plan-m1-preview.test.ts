// PAP-2366 / PLT-PRODUCT-PLAN: runtime fixture removal regression; historical M1 sources retained in Git history.
import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {productPlanStageQuery} from "./product-plan-stage-admission";
import {nativePlanSchema} from "./product-plan-native-binding";
const root="app/ho/billing/product-plans/";
test("obsolete M1 source and local builder are retired",()=>{
 for(const p of [root+"ProductPlanM1Content.tsx",root+"product-plan-m1-preview.ts","scripts/build-native-m1-product-plans.mjs","scripts/native-m1-local/product-plans-entry.tsx"])assert.equal(existsSync(p),false,p);
 const page=readFileSync(root+"page.tsx","utf8");
 assert.match(page,/ProductPlanNativeEntry/);assert.doesNotMatch(page,/ProductPlanM1Content|product-plan-m1-preview|createPreviewState/);
});
test("native relation and history use real provider; preview queries denied",()=>{
 assert.equal(nativePlanSchema.data.id,"product-plans-native");
 assert.equal(nativePlanSchema.detail.businessTabs[0].source.adapter,"product-plan-subscriptions-native");
 assert.equal(nativePlanSchema.detail.history.kind,"provider");
 for(const q of [{m1Preview:"1"},{record:"PRODUCT-PLAN-MOCK-001"}])assert.equal(productPlanStageQuery("staging","ho.staging.pinohouse.art",q),null);
});
