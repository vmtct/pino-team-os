// PAP-2365 / PLT-PRODUCT-PLAN: exact HO Product Plan transport boundary.
import {catalogPath,isPlanId,encodePlanPatch,type CatalogPort} from "./product-plan-native-contract";
export const planHost="ho.staging.pinohouse.art";
export const planActorHeader="x-pino-expected-principal";
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
export function planRequest(path:string,method:string){
 if(!path.startsWith(catalogPath)||path.includes("#")||path.includes("%")||path.includes("\\"))return null;
 const [pathname,query,...extra]=path.split("?");
 if(extra.length)return null;
 const parts=pathname===catalogPath?[]:pathname.startsWith(catalogPath+"/")?pathname.slice(catalogPath.length+1).split("/"):["invalid"];
 const id=parts[0]??null,relation=parts[1]??null;
 if(parts.length>2||(id!==null&&!isPlanId(id)))return null;
 if(relation===null){if(query!==undefined||!(method==="GET"||method==="PATCH"&&id!==null))return null;}
 else{
  if(method!=="GET"||!(relation==="subscriptions"||relation==="history")||query==="")return null;
  const q=new URLSearchParams(query);
  if([...q.keys()].some(k=>!["limit","after"].includes(k)||q.getAll(k).length!==1))return null;
  if(q.has("limit")&&!/^(?:[1-9][0-9]?|100)$/.test(q.get("limit")!))return null;
  if(q.has("after")&&!isPlanId(q.get("after")))return null;
 }
 return {id,relation,corePath:"ho/billing/product-plans"+path.slice(catalogPath.length)};
}
export function parseCatalogBody(x:unknown){
 if(!record(x)||typeof x.expectedVersion!=="number"||!Number.isSafeInteger(x.expectedVersion)||x.expectedVersion<1)return null;
 const keys={displayName:"name",cadence:"cadence",termWeeks:"termWeeks",listPriceMinor:"price",badge:"badge",enabled:"enabled"} as const;
 const patch:Record<string,unknown>={};
 for(const [key,value] of Object.entries(x)){
  if(key==="expectedVersion")continue;
  if(!Object.hasOwn(keys,key))return null;
  patch[keys[key as keyof typeof keys]]=value;
 }
 return encodePlanPatch(patch,String(x.expectedVersion))?.body??null;
}
export function createPlanBrowserPort(actor:string,origin:string,fetcher:typeof fetch=fetch):CatalogPort{
 if(!isPlanId(actor)||origin!=="https://"+planHost||(typeof window!=="undefined"&&window.location.origin!==origin))throw Error("Invalid HO Product Plan context");
 return async(path,init)=>{
  if(!planRequest(path,init.method)||(init.method==="PATCH"&&!parseCatalogBody(init.body))||(init.method==="GET"&&init.body!==undefined))throw Error("Invalid catalog request");
  init.signal.throwIfAborted();
  const response=await fetcher(path,{method:init.method,signal:init.signal,credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{[planActorHeader]:actor,...(init.method==="PATCH"?{"content-type":"application/json"}:{})},
    ...(init.body?{body:JSON.stringify(init.body)}:{})});
  const payload:unknown=await response.json().catch(()=>null);
  return {status:response.status,data:record(payload)?payload.data:undefined};
 };
}
