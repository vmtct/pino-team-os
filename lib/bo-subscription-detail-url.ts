/** Compatibility-only BO ?module=subscriptions URL until the approved /bo/subscriptions/:id route is admitted. */
export type SubscriptionDetailTab = "Detail" | "Enrollment" | "Chuyên đề" | "Lịch Sử";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tabs:Record<string,SubscriptionDetailTab>={overview:"Detail",enrollment:"Enrollment",specialty:"Chuyên đề",history:"Lịch Sử"};
const slugs:Record<SubscriptionDetailTab,string>={Detail:"overview",Enrollment:"enrollment","Chuyên đề":"specialty","Lịch Sử":"history"};
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
  url.searchParams.delete("specialtyRecord");
  if(id){if(!UUID.test(id))throw new Error("Invalid subscription ID");url.searchParams.set("record",id);if(tab!=="Detail")url.searchParams.set("tab",slugs[tab]);}
  return url.pathname+url.search+url.hash;
}

/** PAP-1496: URL carries identity only; actual scope comes from attested Subscription. */
const UUID_V7=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function readLinkedSpecialtyRoute(search:string){
 const p=new URLSearchParams(search),values=p.getAll("specialtyRecord");
 if(!values.length)return {id:null,invalid:false};
 const sub=p.getAll("record"),tabs=p.getAll("tab");
 if(values.length!==1||!UUID_V7.test(values[0]!)||sub.length!==1||!UUID_V7.test(sub[0]!)||tabs.length!==1||tabs[0]!=="specialty")
  return {id:null,invalid:true};
 return {id:values[0]!,invalid:false};
}
export function linkedSpecialtyDetailUrl(href:string,subscriptionId:string,specialtyId:string){
 if(!UUID_V7.test(subscriptionId)||!UUID_V7.test(specialtyId))throw Error("Invalid linked Specialty identity");
 const url=new URL(subscriptionDetailUrl(href,subscriptionId,"Chuyên đề"),href);
 url.searchParams.set("specialtyRecord",specialtyId);
 return url.pathname+url.search+url.hash;
}
