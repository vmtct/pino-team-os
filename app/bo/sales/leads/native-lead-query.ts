/** PAP-2288 / PLT-LEAD: native navigation only; never a permission or scope grant. */
const leadId=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tabs=["detail","members","relationships","history"] as const;
type Tab=typeof tabs[number];
type Query=URLSearchParams|Readonly<Record<string,string|string[]|undefined>>;
export type NativeLeadQuery={kind:"household";centerId:string|null;lead:string|null;quickView:string|null;tab:Tab|null;canonical:string}|{kind:"legacy-intent";centerId:string|null;leadIntent:string;canonical:string};
export function parseNativeLeadQuery(input:Query):NativeLeadQuery|null{
 const p=new URLSearchParams();
 if(input instanceof URLSearchParams){for(const [k,v] of input)p.append(k,v);}
 else{for(const [k,v] of Object.entries(input)){if(Array.isArray(v))for(const value of v)p.append(k,value);else if(v!==undefined)p.append(k,v);}}
 for(const [k,v] of p){if(!["centerId","lead","quickView","tab","leadIntent"].includes(k)||p.getAll(k).length!==1||!v||v.length>64)return null;}
 const centerId=p.get("centerId"),lead=p.get("lead"),quickView=p.get("quickView"),tab=p.get("tab"),leadIntent=p.get("leadIntent");
 if(centerId!==null&&!uuid.test(centerId))return null;
 const out=new URLSearchParams();
 if(centerId)out.set("centerId",centerId);
 if(leadIntent!==null){
  if(!uuid.test(leadIntent)||lead!==null||quickView!==null||tab!==null)return null;
  out.set("leadIntent",leadIntent);
  return {kind:"legacy-intent",centerId,leadIntent,canonical:out.toString()};
 }
 if(lead!==null&&!leadId.test(lead)||quickView!==null&&!leadId.test(quickView)||lead!==null&&quickView!==null)return null;
 if(tab!==null&&(lead===null||!tabs.some(t=>t===tab)))return null;
 if(lead)out.set("lead",lead);
 if(quickView)out.set("quickView",quickView);
 if(tab)out.set("tab",tab);
 return {kind:"household",centerId,lead,quickView,tab:tab as Tab|null,canonical:out.toString()};
}
