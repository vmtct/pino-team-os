/** PAP-2203 — safe navigation hints, never authority. */
import {BO_LEGACY_QUERY_MODULES,BO_TARGET_ROUTES} from "./bo-url-contract";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";
import {readLinkedSpecialtyRoute} from "./bo-subscription-detail-url";
import {readWishDetailRoute} from "./pls-wish-detail-route";
export const BO_STAGING_RETURN_HOST="bo.staging.pinohouse.art";
export const BO_RETURN_HEADER="x-pino-bo-return-to";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=/^[A-Za-z0-9_-]{1,128}$/;
const tracking=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
const general=new Set(["centerId","record","tab","view","search","sort","filter","page","cursor","from","to"]);
const payroll=new Set(["incomeStaff","incomeException","incomeDrawer","incomeDay","fromSettlement"]);
const wish=new Set(["wishCenter","rewardOrdinal","rewardItem","rewardRevision"]);
const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
export function safeBoStagingReturnTo(raw:string|null|undefined):string|null{
 if(!raw||raw.length>2048||/[\\\x00-\x1f\x7f#]/.test(raw))return null;
 let path=raw.split("?")[0]!;
 if(!/^\/bo(?:\/[A-Za-z0-9_-]+)*\/?$/.test(path))return null;
 path=path.replace(/\/$/,"");
 const p=new URLSearchParams(raw.includes("?")?raw.slice(raw.indexOf("?")+1):"");
 for(const k of tracking)p.delete(k);
 for(const k of p.keys()){
  const v=p.get(k)!;
  if(p.getAll(k).length!==1||!v||v.length>256||/[\x00-\x1f\x7f\\]/.test(v))return null;
 }
 let moduleKey=p.get("module");
 if(path==="/bo/subscriptions"){if(moduleKey!==null&&moduleKey!=="subscriptions")return null;path="/bo";moduleKey="subscriptions";p.set("module",moduleKey);}
 if(path==="/bo/registrations"){if(moduleKey!==null)return null;path="/bo/enrollments";p.delete("record");p.delete("sessionId");}
 if(path==="/bo/mytime-guests"){if(moduleKey!==null)return null;path="/bo/guests";}
 if(path==="/bo/open-studio"){if(p.size)return null;path="/bo/open-studio-passes";}
 if(path==="/bo"){
  if(moduleKey!==null&&!BO_LEGACY_QUERY_MODULES.some(k=>k===moduleKey))return null;
  if(moduleKey==="enrollments"){path="/bo/enrollments";p.delete("module");}
  if(moduleKey==="salaryPeriods"){path="/bo/payroll-periods";p.delete("module");}
 }else if(moduleKey!==null)return null;
 if(path!=="/bo"&&!isBoStagingRouteAdmitted(path))return null;
 const key=path==="/bo"?moduleKey??"students":path.split("/")[2]!;
 const sub=key==="subscriptions",period=key==="payroll-periods",event=key==="pinoria-wish-events";
 for(const k of p.keys()){
  const v=p.get(k)!;
  if(k==="module"&&path==="/bo")continue;
  if(!general.has(k)&&!(sub&&["specialtyRecord","studentId"].includes(k))&&!(period&&payroll.has(k))&&!(event&&wish.has(k)))return null;
  if(k==="centerId"&&!uuid.test(v))return null;
  if(k==="record"&&(sub||period||event||key==="enrollments"?!uuid.test(v):!id.test(v)))return null;
  if(["specialtyRecord","studentId","incomeStaff","incomeException","incomeDrawer"].includes(k)&&!uuid.test(v))return null;
  if(["from","to","incomeDay"].includes(k)&&!date(v))return null;
  if(k==="page"&&!/^[1-9]\d{0,5}$/.test(v))return null;
  if(k==="fromSettlement"&&v!=="1")return null;
 }
 const tab=p.get("tab"),record=p.get("record"),dynamic=path.split("/").length>3;
 const tabs=sub?["overview","enrollment","specialty","history"]:period?["overview","settlements","history"]:event?["overview","items","history"]:BO_TARGET_ROUTES.find(r=>r.key===key)?.tabs??["overview","history"];
 if(tab&&((!record&&!dynamic)||!tabs.some(t=>t===tab)))return null;
 if(dynamic&&record)return null;
 if(sub&&p.has("specialtyRecord")&&readLinkedSpecialtyRoute(p.toString()).invalid)return null;
 if(period){
  const staff=p.has("incomeStaff"),day=p.has("incomeDay"),exception=p.has("incomeException"),drawer=p.has("incomeDrawer"),from=p.has("fromSettlement");
  if([...payroll].some(k=>p.has(k))&&!record)return null;
  if((day||exception||from)&&!staff||from&&!day||exception&&(day||drawer||from)||drawer&&(staff||tab!=="settlements")||staff&&tab==="settlements")return null;
 }
 if(event){try{const center=p.get("wishCenter");if(center&&p.has("centerId")&&center!==p.get("centerId"))return null;readWishDetailRoute(p.toString(),"event",center??undefined);}catch{return null;}}
 const out=new URLSearchParams();
 for(const k of ["module","centerId","record","tab"])if(p.has(k))out.set(k,p.get(k)!);
 for(const [k,v] of p)if(!out.has(k))out.set(k,v);
 return path+(out.size?"?"+out.toString():"");
}
export function boStagingReturnFromSearch(search:string):string|null{
 const values=new URLSearchParams(search).getAll("returnTo");
 return values.length===1?safeBoStagingReturnTo(values[0]):null;
}
export function boStagingAuthPath(path:"/staff-login"|"/staff-password/change",raw:string|null|undefined):string{
 const ret=safeBoStagingReturnTo(raw);
 return ret?path+"?"+new URLSearchParams({returnTo:ret}).toString():path;
}
export function boStagingAuthContinuation(path:"/staff-login"|"/staff-password/change",search:string):string{
 return boStagingAuthPath(path,boStagingReturnFromSearch(search));
}
