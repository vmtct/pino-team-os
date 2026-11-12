/** PAP-1897 / PAP-1491 — Sale 201 receipt is authoritative; Bill GET 403 cannot falsify success. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {assertIndependentSaleReadback, type IndependentSaleBody} from "./pap1882-independent-sale";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const student="01a1a61c-ab78-7ade-8a26-37c0aaef0332";
const payer="01a1a61c-ab78-7ade-8a26-37c0aaef0333";
const path="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const plan="01a1a61c-ab78-7ade-8a26-37c0aaef0334";
const sub="01a1a61c-ab78-7ade-8a26-37c0aaef0335";
const bill="01a1a61c-ab78-7ade-8a26-37c0aaef0336";
const input:IndependentSaleBody={centerId:center,studentProfileId:student,payerParentUserId:payer,
  pathProgramId:path,productPlanId:plan,contractualStartsOn:"2026-11-12",
  contractualEndsOn:"2027-02-07",itemDiscountMinor:0,billDiscountMinor:0};
const result={subscriptionId:sub,bill:{bill:{id:bill},items:[{subscriptionId:sub,studentProfileId:student}]}};
const actual={id:sub,centerId:center,studentProfileId:student,pathProgramId:path,lifecycle:"ACTIVE"};
test("PAP-1897 Core Sale 201 includes enough transactional Bill + Item proof; no extra Bill read",()=>{
 assert.doesNotThrow(()=>assertIndependentSaleReadback(input,result,actual));
 const drawer=readFileSync("app/bo/subscriptions/SubscriptionCreateDrawer.tsx","utf8");
 assert.match(drawer,/const sale=await boApi\.createBillingSale\(attempt\.body,attempt\.key\)/);
 assert.match(drawer,/const verified=await readSubscriptionCenterDetail\(sale\.subscriptionId,attempt\.centerId\)/);
 assert.match(drawer,/assertIndependentSaleReadback\(attempt\.body,sale,verified\)/);
 assert.doesNotMatch(drawer,/boApi\.billingBill\(/);
 assert.match(drawer,/saleCommitted=true/);
 assert.match(drawer,/const definitive=!saleCommitted&&cause instanceof BoApiError/);
});
test("PAP-1897 fail closed on missing/malformed Bill receipt, duplicate/missing Item",()=>{
 for(const missing of [
   {...result,bill:{...result.bill,bill:{id:"invalid"}}},
   {...result,bill:{...result.bill,items:[]}},
   {...result,bill:{...result.bill,items:result.bill.items.concat(result.bill.items)}},
   {...result,bill:{...result.bill,items:[{...result.bill.items[0],studentProfileId:payer}]}},
   {...result,bill:null},
   {...result,bill:{...result.bill,bill:null}},
 ]){
   assert.throws(()=>assertIndependentSaleReadback(input,missing as typeof result,actual));
 }
});
test("PAP-1897 architecture guard explicitly rejects secondary privileged Bill GET",()=>{
 const guard=readFileSync("scripts/verify-bo-runtime-surface-ownership.mjs","utf8");
 assert.match(guard,/const forbiddenCreate=\["boApi\.billingBill\("/);
 assert.match(guard,/requiredCreate/);
});
