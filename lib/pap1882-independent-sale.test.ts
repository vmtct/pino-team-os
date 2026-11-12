/** PAP-1882 / PAP-1491 — actual independent Center-scoped Sale helper and native DS Create contract. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { eligibleSalePayers, validSaleCenter, buildIndependentSaleBody, assertIndependentSaleReadback, type IndependentSaleBody } from "./pap1882-independent-sale";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const student="01a1a61c-ab78-7ade-8a26-37c0aaef0332";
const payer="01a1a61c-ab78-7ade-8a26-37c0aaef0333";
const path="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const planId="01a1a61c-ab78-7ade-8a26-37c0aaef0334";
const sub="01a1a61c-ab78-7ade-8a26-37c0aaef0335";
const bill="01a1a61c-ab78-7ade-8a26-37c0aaef0336";
const input:IndependentSaleBody={
  centerId:center,studentProfileId:student,payerParentUserId:payer,pathProgramId:path,productPlanId:planId,
  contractualStartsOn:"2026-11-12",contractualEndsOn:"2027-02-07",itemDiscountMinor:100_000,billDiscountMinor:50_000,
};
const product={id:planId,listPriceMinor:1_600_000,termWeeks:12,cadence:2,enabled:true};
const parents=[{id:payer,displayName:"Phụ huynh thử nghiệm"}];

test("PAP-1882 only Center-attested Student and eligible payer GET with exact two keys",async()=>{
  assert.equal(validSaleCenter(center,[{id:center}]),true);
  assert.equal(validSaleCenter(center,[{id:student}]),false);
  let calls=0;
  const transport:typeof fetch=async(req,options)=>{
    calls++;
    assert.equal(String(req),"/api/bo/billing/sales/eligible-payers?centerId="+center+"&studentProfileId="+student);
    assert.equal(options?.method,"GET");
    assert.equal(options?.cache,"no-store");
    assert.equal(options?.credentials,"same-origin");
    assert.equal(options?.signal?.aborted,false);
    return new Response(JSON.stringify({data:parents}),{status:200});
  };
  const returned=await eligibleSalePayers(center,student,new AbortController().signal,transport);
  assert.deepEqual(returned,parents);
  assert.equal(calls,1);
  await assert.rejects(eligibleSalePayers("",student,new AbortController().signal,transport));
  assert.equal(calls,1,"Malformed Center must fail before reaching Core");
});
test("PAP-1882 Parent reader rejects forged/invalid/ambiguous payloads and denied scope",async()=>{
  const fake=(status:number,data:unknown):typeof fetch=>async()=>new Response(JSON.stringify(
    status===200?{data}:{error:{message:"Không được phép",requestId:"qa"}}),{status});
  await assert.rejects(eligibleSalePayers(center,student,new AbortController().signal,fake(403,null)));
  for(const data of [[{id:"not-uuid",displayName:"Alice"}],parents.concat(parents),[{id:payer,displayName:"  "}],{items:parents}]){
    await assert.rejects(eligibleSalePayers(center,student,new AbortController().signal,fake(200,data)));
  }
});
test("PAP-1882 independent Sale rejects wrong Plan/Parent/discount/date; no placement or renewal in input",()=>{
  assert.deepEqual(buildIndependentSaleBody(input,product,parents),input);
  for(const bad of [
    {...input,payerParentUserId:student},
    {...input,centerId:""},
    {...input,itemDiscountMinor:1_600_001},
    {...input,billDiscountMinor:1_500_001},
    {...input,contractualEndsOn:"2026-11-11"},
    {...input,contractualStartsOn:"2026-02-30"},
  ])assert.throws(()=>buildIndependentSaleBody(bad,product,parents));
  for(const badPlan of [{...product,enabled:false},{...product,cadence:4},{...product,termWeeks:24}])
    assert.throws(()=>buildIndependentSaleBody(input,badPlan,parents));
  assert.equal("deferActivation" in input,false);
  assert.equal("runningClassId" in input,false);
  assert.equal("enrollments" in input,false);
});
test("PAP-1882 readback requires exact Center, Student, ACTIVE and canonical Bill Item",()=>{
  const sale={subscriptionId:sub,bill:{bill:{id:bill},items:[{subscriptionId:sub,studentProfileId:student}]}};
  const actual={id:sub,centerId:center,studentProfileId:student,pathProgramId:path,lifecycle:"ACTIVE"};
  assert.doesNotThrow(()=>assertIndependentSaleReadback(input,sale,actual));
  for(const defect of [{...actual,centerId:payer},{...actual,lifecycle:"DRAFT"},{...actual,studentProfileId:payer}])
    assert.throws(()=>assertIndependentSaleReadback(input,sale,defect));
  assert.throws(()=>assertIndependentSaleReadback(input,{...sale,bill:{...sale.bill,items:[]}},actual));
});
test("PAP-1882 Create shares DS frame/property rows; feature-scoped Center reader and no placement commands",()=>{
  const drawer=readFileSync("app/bo/subscriptions/SubscriptionCreateDrawer.tsx","utf8");
  const parent=readFileSync("app/bo/subscriptions/BoSubscriptionsView.tsx","utf8");
  assert.match(drawer,/DrawerFrame/);assert.match(drawer,/<PropertySections/);
  assert.match(drawer,/nativeSubscriptionModule/);
  assert.match(drawer,/studentCenterApi\.learners\(/);
  assert.match(drawer,/studentCenterApi\.learnerLifecycle\(/);
  assert.match(drawer,/eligibleSalePayers\(/);
  assert.match(drawer,/boApi\.createBillingSale\(/);
  assert.match(drawer,/assertIndependentSaleReadback\(/);
  assert.match(drawer,/id="pap1882-sale-form"/);
  assert.doesNotMatch(drawer,/placeBulkEnrollments|activateSubscription|finalizeRegistration|renewSubscription/);
  // React list keys may contain IDs; only user-visible text must not show them.
  assert.doesNotMatch(drawer,/<small>\{row\.id\}|<strong>\{row\.id\}|\.id\.slice\(/);
  assert.match(parent,/<SubscriptionCreateDrawer/);
  const native=readFileSync("app/bo/subscriptions/SubscriptionDirectoryDsa.tsx","utf8");
  const runtime=readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx","utf8");
  assert.match(runtime,/content=\{<SubscriptionDirectoryDsa \/>\}/);
  assert.match(native,/<SubscriptionCreateDrawer/,"new drawer must mount in actual BO native DSA");
  assert.match(native,/onClick=\{\(\)=>void openCreate\(\)\}/);
  assert.match(native,/boApi\.scopeCatalog\(\)/);
  assert.doesNotMatch(native,/boApi\.createBillingSale\(/,"native read-only Table must not gain inline writers");
  const oldBilling=readFileSync("app/bo/subscriptions/BillingWorkspace.tsx","utf8");
  assert.match(oldBilling,/\{createOnly \? <form/,"old placement-gated Sale is hidden outside the retired Create-only mode");
  assert.ok(parent.includes("!selectedCenter || selectedCenter.loading"));
});