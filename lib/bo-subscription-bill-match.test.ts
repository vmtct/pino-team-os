import {test} from "node:test";
import assert from "node:assert/strict";
import {subscriptionBillItem} from "./bo-subscription-bill-match";
import type {BoBillItem} from "./bo-model";

const sub={id:"subscription-1",studentProfileId:"student-1",productPlanId:"plan-1"};
const item={id:"item-1",billId:"bill-1",studentProfileId:"student-1",subscriptionId:"subscription-1",productPlanId:"plan-1",quantity:1,unitPriceMinor:1990000,discountAmountMinor:100000,descriptionSnapshot:"Plan snapshot",createdAt:"2026-10-28T00:00:00.000Z"} satisfies BoBillItem;

test("PAP-1102 only shows the uniquely matching Core BillItem",()=>{
  assert.deepEqual(subscriptionBillItem({items:[item]},sub),item);
  assert.equal(subscriptionBillItem(null,sub),null);
  assert.equal(subscriptionBillItem({items:[]},sub),null);
  assert.equal(subscriptionBillItem({items:[item,item]},sub),null);
  assert.equal(subscriptionBillItem({items:[{...item,studentProfileId:"another-student"}]},sub),null);
  assert.equal(subscriptionBillItem({items:[{...item,productPlanId:"another-plan"}]},sub),null);
  assert.equal(subscriptionBillItem({items:[{...item,subscriptionId:"another-subscription"}]},sub),null);
  assert.equal(subscriptionBillItem({items:[item]},{...sub,productPlanId:null}),null);
});
