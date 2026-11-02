import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestedContractSunday, amountFromPercent, percentFromAmount, quoteAfterDiscounts } from "./bo-subscription-create-ux";

test("12-week Sunday prefill is timezone-independent and editable in Create form", () => {
  assert.equal(suggestedContractSunday("2026-10-27",12),"2027-01-24");
  assert.equal(suggestedContractSunday("2026-11-01",12),"2027-01-24");
  assert.equal(suggestedContractSunday("2026-13-01",12),"");
  assert.equal(suggestedContractSunday("2026-02-30",12),"");
  const source=readFileSync("app/bo/subscriptions/BillingWorkspace.tsx","utf8");
  assert.match(source,/setEndManual\(true\)/);
  assert.match(source,/setEndManual\(false\)/);
  assert.match(source,/contractualEndsOn: contractEndsOn \|\| null/);
});
test("item and bill percentages are symmetric and bill is based on item-net", () => {
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
test("invalid discounts never become a valid Core request", () => {
  assert.equal(quoteAfterDiscounts(1000,500,501).valid,false);
  assert.equal(quoteAfterDiscounts(1000,-1,0).valid,false);
  assert.equal(quoteAfterDiscounts(1000,0,0).valid,true);
  assert.ok(Number.isNaN(amountFromPercent(1000,101)));
  assert.ok(Number.isNaN(percentFromAmount(1000,1001)));
});
test("single Student search and shared Core sale flow, no duplicate sale engine", () => {
  const drawer=readFileSync("app/bo/subscriptions/SubscriptionCreateDrawer.tsx","utf8");
  const billing=readFileSync("app/bo/subscriptions/BillingWorkspace.tsx","utf8");
  const parent=readFileSync("app/bo/subscriptions/BoSubscriptionsView.tsx","utf8");
  assert.equal((drawer.match(/id="subscription-create-student-search"/g)||[]).length,1);
  assert.match(drawer,/boApi\.learners\(query\.trim\(\),20\)/);
  assert.match(drawer,/boApi\.learnerLifecycle\(row\.id\)/);
  assert.match(drawer,/useBoDialog\(true,safeClose,panel\)/);
  assert.match(parent,/onClick=\{\(\) => setCreateOpen\(true\)\}/);
  assert.match(billing,/boApi\.createBillingSale/);
  assert.match(billing,/boApi\.placeBulkEnrollments/);
  assert.match(billing,/boApi\.activateSubscription/);
  assert.match(billing,/sellablePaths/);
  assert.match(billing,/sellablePlans/);
  assert.doesNotMatch(drawer,/createBillingSale\(/);
});
