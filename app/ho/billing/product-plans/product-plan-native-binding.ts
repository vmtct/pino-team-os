// PAP-2365 / PLT-PRODUCT-PLAN. Bind only the approved Product Plans schema.
import {TddRegistry,type AuthorizationContext,type ModuleSchema,type HistoryEvent} from "@/lib/workspace-schema";
import {planDefinition,PLAN_READ,PLAN_EDIT,type PlanFields} from "./schema";
import {CatalogRequestError,isPlanId,type createProductPlanClient} from "./product-plan-native-contract";
export type PlanClient=ReturnType<typeof createProductPlanClient>;
export const nativePath="/ho/billing/product-plans";
export const planTabs=["overview","subscriptions","history"] as const;
export type PlanTab=typeof planTabs[number];
export function parseNativePlanQuery(query:URLSearchParams){
 if([...query.keys()].some(k=>!["record","tab"].includes(k)||query.getAll(k).length!==1))return null;
 const record=query.get("record"),tab=query.get("tab");
 if(record!==null&&!isPlanId(record)||tab!==null&&(!record||!planTabs.includes(tab as PlanTab)))return null;
 return {record,tab:(tab??"overview") as PlanTab};
}
export function nativePlanUrl(record:string|null,tab:PlanTab="overview"){
 if(record!==null&&!isPlanId(record)||!planTabs.includes(tab)||record===null&&tab!=="overview")throw Error("Invalid Product Plan navigation");
 const q=new URLSearchParams();if(record)q.set("record",record);if(tab!=="overview")q.set("tab",tab);
 return nativePath+(q.size?"?"+q:"");
}
const fields={displayName:"name",cadence:"cadence",termWeeks:"termWeeks",listPriceMinor:"price",enabled:"enabled",badge:"badge"} as const;
export function bindPlanSchema(client:PlanClient,context:AuthorizationContext){
 const registry=new TddRegistry();
 const permitted=(incoming:AuthorizationContext)=>incoming===context&&context.surface==="HO"&&context.authorize(PLAN_READ);
 const definition:ModuleSchema<PlanFields>={...planDefinition,
 capabilities:{read:PLAN_READ,edit:PLAN_EDIT,history:PLAN_READ},
 data:{id:"product-plans-native",list:async(_query,incoming,signal)=>{if(!permitted(incoming))throw new CatalogRequestError(403);const rows=await client.list(signal);return {rows,total:rows.length};},
 detail:async(id,incoming,signal)=>{if(!permitted(incoming))throw new CatalogRequestError(403);return client.detail(id,signal);}},
 detail:{...planDefinition.detail,businessTabs:[{...planDefinition.detail.businessTabs[0],source:{adapter:"product-plan-subscriptions-native",permission:PLAN_READ}}],
 history:{kind:"provider",source:{adapter:"product-plan-history-native",permission:PLAN_READ},load:async(subject,incoming,cursor,signal)=>{
 if(!permitted(incoming)||subject.type!=="product_plan"||!isPlanId(subject.id))return {status:"denied"};
 try{
 const page=await client.history(subject.id,signal,cursor);
 const events:HistoryEvent[]=page.items.map(event=>({id:event.id,at:event.at,actor:event.actor,action:event.action,outcome:"succeeded",source:"Core",subject,redacted:true,
 changes:Object.entries(fields).flatMap(([wire,field])=>{if(!event.previous||!event.next||!Object.hasOwn(event.previous,wire)||!Object.hasOwn(event.next,wire))return [];const before=event.previous[wire],after=event.next[wire];
 return before===after?[]:[{field,before,after}];})}));
 return {status:"authorized",events,nextCursor:page.nextAfter};
 }catch(e){if(e instanceof CatalogRequestError&&(e.status===401||e.status===403))return {status:"denied"};throw e;}
 }} }};
 return {registry,schema:registry.register(definition)};
}
