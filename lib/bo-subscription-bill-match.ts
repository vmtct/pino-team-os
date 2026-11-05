import type {BoBillItem,BoBillSummary,BoLearnerSubscription} from "./bo-model";

/** Only a uniquely matched Core BillItem may be displayed as this Subscription's sale snapshot. */
export function subscriptionBillItem(
  bill: Pick<BoBillSummary,"items"> | null,
  subscription: Pick<BoLearnerSubscription,"id"|"studentProfileId"|"productPlanId">
):BoBillItem|null{
  if(!bill||!subscription.productPlanId)return null;
  const rows=bill.items.filter(item=>item.subscriptionId===subscription.id);
  if(rows.length!==1)return null;
  const item=rows[0]!;
  return item.studentProfileId===subscription.studentProfileId&&item.productPlanId===subscription.productPlanId?item:null;
}
