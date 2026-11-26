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
 const legacy=p.has("leadIntent");
 const legacyGrid=["q","sort","dir","size","f_status"];
 for(const [k,v] of p){
  if(p.getAll(k).length!==1||!v||v.length>256||/[\x00-\x1f\x7f\\]/.test(v))return null;
  if(!["centerId","lead","quickView","tab","leadIntent"].includes(k)&&!(legacy&&legacyGrid.includes(k)))return null;
  if(k==="dir"&&!["asc","desc"].includes(v)||k==="size"&&(!/^[1-9]\d{0,2}$/.test(v)||Number(v)>100)||k==="f_status"&&!["SUBMITTED","CONTACTED","CONTACT_VERIFIED","CLOSED"].includes(v)||k==="sort"&&!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v))return null;
 }
 const centerId=p.get("centerId"),lead=p.get("lead"),quickView=p.get("quickView"),tab=p.get("tab"),leadIntent=p.get("leadIntent");
 if(centerId!==null&&!uuid.test(centerId))return null;
 const out=new URLSearchParams();
 if(centerId)out.set("centerId",centerId);
 if(leadIntent!==null){
  if(!uuid.test(leadIntent)||lead!==null||quickView!==null||tab!==null)return null;
  out.set("leadIntent",leadIntent);
  for(const k of legacyGrid)if(p.has(k))out.set(k,p.get(k)!);
  return {kind:"legacy-intent",centerId,leadIntent,canonical:out.toString()};
 }
 if(lead!==null&&!leadId.test(lead)||quickView!==null&&!leadId.test(quickView)||lead!==null&&quickView!==null)return null;
 if(tab!==null&&(lead===null||!tabs.some(t=>t===tab)))return null;
 if(lead)out.set("lead",lead);
 if(quickView)out.set("quickView",quickView);
 if(tab)out.set("tab",tab);
 return {kind:"household",centerId,lead,quickView,tab:tab as Tab|null,canonical:out.toString()};
}
