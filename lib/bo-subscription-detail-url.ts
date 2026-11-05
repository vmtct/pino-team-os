/** Compatibility-only BO ?module=subscriptions URL until the approved /bo/subscriptions/:id route is admitted. */
export type SubscriptionDetailTab = "Detail" | "Enrollment" | "Lịch Sử";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tabs:Record<string,SubscriptionDetailTab>={overview:"Detail",enrollment:"Enrollment",history:"Lịch Sử"};
const slugs:Record<SubscriptionDetailTab,string>={Detail:"overview",Enrollment:"enrollment","Lịch Sử":"history"};
export function readSubscriptionDetailRoute(search:string){
  const p=new URLSearchParams(search);
  const raw=p.get("record");
  const id=raw&&UUID.test(raw)?raw:null;
  return {id,invalid:raw!==null&&!id,tab:tabs[p.get("tab")??""]??"Detail"};
}
export function subscriptionDetailUrl(href:string,id:string|null,tab:SubscriptionDetailTab="Detail"){
  const url=new URL(href);
  url.searchParams.delete("record");
  url.searchParams.delete("tab");
  if(id){if(!UUID.test(id))throw new Error("Invalid subscription ID");url.searchParams.set("record",id);if(tab!=="Detail")url.searchParams.set("tab",slugs[tab]);}
  return url.pathname+url.search+url.hash;
}
