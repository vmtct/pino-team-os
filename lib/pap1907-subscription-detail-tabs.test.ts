/** PAP-1907 / PAP-1491 — Center-safe Subscription Detail tabs regression. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {readSubscriptionDetailRoute,subscriptionDetailUrl,type SubscriptionDetailTab} from "./bo-subscription-detail-url";
import {assertCenterDetail} from "./pap1334-native-subscription-read";
const source=readFileSync("app/bo/subscriptions/SubscriptionDirectoryDsa.tsx","utf8");
const subscriptionId="01a1a61c-ab78-7ade-8a26-37c0aaef0335";
const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const validUrl="https://bo.staging.pinohouse.art/bo?module=subscriptions";
test("PAP-1907 restores one shared DetailFrame tablist / panel, never legacyContent short-circuit",()=>{
  for(const [id,label] of [["Detail","Thông tin"],["Enrollment","Enrollment"],["Chuyên đề","Chuyên đề"],["Lịch Sử","Lịch Sử"]]){
    assert.ok(source.includes(`{id:"${id}",label:"${label}"}`),`missing canonical tab ${id}`);
  }
  assert.match(source,/tabs=\{subscriptionDetailTabs\}/);
  assert.match(source,/selected=\{detailTab\} onSelect=\{selectDetailTab\}/);
  assert.match(source,/sections=\{detailTab==="Detail"\?\[detailSections\[0\]\]:\[detailSections\[1\]\]\}/);
  assert.doesNotMatch(source,/legacyContent=/);
  assert.match(source,/data-pap1907-center-safe-business-tab/);
});
test("PAP-1907 all four tabs round-trip via existing Center-scoped record URLs",()=>{
  for(const tab of ["Detail","Enrollment","Chuyên đề","Lịch Sử"] as SubscriptionDetailTab[]){
    const href=subscriptionDetailUrl(validUrl,subscriptionId,tab);
    const parsed=readSubscriptionDetailRoute(new URL("https://bo.staging.pinohouse.art"+href).search);
    assert.equal(parsed.id,subscriptionId);assert.equal(parsed.tab,tab);
    const cleared=subscriptionDetailUrl("https://bo.staging.pinohouse.art"+href,null);
    assert.equal(readSubscriptionDetailRoute(new URL("https://bo.staging.pinohouse.art"+cleared).search).id,null);
    assert.equal(new URL("https://bo.staging.pinohouse.art"+cleared).searchParams.has("tab"),false);
  }
});
test("PAP-1907 cannot show foreign Center or unauthenticated legacy writer data in restored tabs",()=>{
  const wrong={id:subscriptionId,centerId:"01a0b29a-3acd-7a18-a0f2-cf6016548ab6",
    studentProfileId:"01a1a61c-ab78-7ade-8a26-37c0aaef0332",
    pathProgramId:"01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c"};
  assert.throws(()=>assertCenterDetail(wrong as never,subscriptionId,centerId),/selected Center/);
  assert.match(source,/readSubscriptionCenterDetail\(item\.id,centerId,ctl\.signal\)/);
  assert.doesNotMatch(source,/boApi\.subscriptionById\(|boApi\.learnerLifecycle\(|<BillingWorkspace|<SpecialtyWorkspace/);
  assert.match(source,/Không mở lại tác vụ ghi cũ khi chưa xác thực Center/);
});

test("PAP-1907 URL reload restores Full Detail; only a Table click opens Quick View",()=>{
  assert.match(source,/if\(pushUrl\)\{\s*setDetail\(null\);setDrawer\(\{id:item\.id,row\}\)/);
  assert.match(source,/\}else\{\s*setDrawer\(null\);setDetail\(\{id:item\.id,row\}\)/);
  assert.match(source,/queueMicrotask\(\(\)=>void verify\(matching,false\)\)/);
  assert.match(source,/const nextTab=pushUrl\?"Detail":route\.id===item\.id\?route\.tab:"Detail"/);
  assert.match(source,/readSubscriptionCenterDetail\(item\.id,centerId,ctl\.signal\)/);
});
