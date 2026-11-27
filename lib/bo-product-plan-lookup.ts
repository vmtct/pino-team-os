import type {BoProductPlan} from "./bo-model";
type LookupPlan=Pick<BoProductPlan,"id"|"cadence"|"termWeeks"|"listPriceMinor">&{displayName?:unknown};
function baseLabel(plan:LookupPlan):string {
  const terms=plan.cadence+" buổi/tuần · "+plan.termWeeks+" tuần";
  const name=typeof plan.displayName==="string"?plan.displayName.trim():"";
  const price=new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(plan.listPriceMinor);
  return (name?name+" · ":"")+terms+" · "+price;
}
export function productPlanLookupLabel(plan:LookupPlan, plans:readonly LookupPlan[]):string {
  const label=baseLabel(plan);
  const matches=plans.filter(item=>baseLabel(item)===label);
  if(matches.length<2)return label;
  const short=plan.id.slice(-8);
  return label+" · #"+(matches.filter(item=>item.id.endsWith(short)).length===1?short:plan.id);
}
