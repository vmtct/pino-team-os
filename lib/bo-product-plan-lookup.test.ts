import test from "node:test";
import assert from "node:assert/strict";
import {productPlanLookupLabel} from "./bo-product-plan-lookup";
test("current names, duplicate current terms and exact stable ID labels",()=>{
 const first={id:"01990000-0000-7000-8000-000000000001",displayName:"Gói A",cadence:2,termWeeks:12 as const,listPriceMinor:4000000};
 const second={...first,id:"01990000-0000-7000-8000-000000000002",displayName:"Gói B"};
 assert.ok(productPlanLookupLabel(first,[first,second]).startsWith("Gói A · 2 buổi/tuần · 12 tuần"));
 assert.notEqual(productPlanLookupLabel(first,[first,second]),productPlanLookupLabel(second,[first,second]));
 const duplicate={...second,displayName:first.displayName};
 assert.ok(productPlanLookupLabel(first,[first,duplicate]).endsWith("#00000001"));
 assert.ok(productPlanLookupLabel(duplicate,[first,duplicate]).endsWith("#00000002"));
 const legacy={...first,displayName:undefined};
 assert.ok(productPlanLookupLabel(legacy,[legacy]).startsWith("2 buổi/tuần · 12 tuần"));
});
