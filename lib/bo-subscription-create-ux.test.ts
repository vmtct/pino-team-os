import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestedContractSunday, amountFromPercent, percentFromAmount, quoteAfterDiscounts } from "./bo-subscription-create-ux";

test("12-week Sunday prefill is timezone-independent and editable in new independent Sale Create",()=>{
  assert.equal(suggestedContractSunday("2026-10-27",12),"2027-01-24");
  assert.equal(suggestedContractSunday("2026-11-01",12),"2027-01-24");
  assert.equal(suggestedContractSunday("2026-13-01",12),"");
  assert.equal(suggestedContractSunday("2026-02-30",12),"");
  const drawer=readFileSync("app/bo/subscriptions/SubscriptionCreateDrawer.tsx","utf8");
  assert.match(drawer,/setEndManual\(true\)/);
  assert.match(drawer,/setEndManual\(false\)/);
  assert.match(drawer,/contractualEndsOn:contractEndsOn/);
});
test("item and bill percentages are symmetric and bill is based on item-net",()=>{
  const gross=3_900_000;
  const item=amountFromPercent(gross,10);
  const bill=amountFromPercent(gross-item,5);
  assert.equal(item,390_000);
  assert.equal(bill,175_500);
  assert.equal(quoteAfterDiscounts(gross,item,bill).net,3_334_500);
  assert.equal(percentFromAmount(gross,item),10);
  assert.equal(percentFromAmount(gross-item,bill),5);
  assert.equal(percentFromAmount(gross,100_000),2.56);
});
test("invalid discounts never become a valid Core request",()=>{
  assert.equal(quoteAfterDiscounts(1000,500,501).valid,false);
  assert.equal(quoteAfterDiscounts(1000,-1,0).valid,false);
  assert.equal(quoteAfterDiscounts(1000,0,0).valid,true);
  assert.ok(Number.isNaN(amountFromPercent(1000,101)));
  assert.ok(Number.isNaN(percentFromAmount(1000,1001)));
});
test("PAP-1882 independent Sale replaced old placement-gated Create drawer only",()=>{
  const drawer=readFileSync("app/bo/subscriptions/SubscriptionCreateDrawer.tsx","utf8");
  const parent=readFileSync("app/bo/subscriptions/BoSubscriptionsView.tsx","utf8");
  assert.match(drawer,/studentCenterApi\.learners\(/);
  assert.match(drawer,/studentCenterApi\.learnerLifecycle\(/);
  assert.match(drawer,/boApi\.createBillingSale/);
  assert.match(drawer,/eligibleSalePayers/);
  assert.match(drawer,/<DrawerFrame/);
  assert.match(drawer,/<PropertySections/);
  assert.match(parent,/onClick=\{\(\) => setCreateOpen\(true\)\}/);
  assert.doesNotMatch(drawer,/placeBulkEnrollments|activateSubscription|deferActivation:\s*true/);
  assert.doesNotMatch(drawer,/createRenewal|successor|pendingRegistrationEntries/);
  assert.doesNotMatch(drawer,/row\.id\}<\/small>/);
});