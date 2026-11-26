/** PAP-2288 / PLT-LEAD — bind the server-verified BO actor to a single native adapter lifetime. */
import {createLeadHouseholdApi,LeadApiError} from "@/lib/bo-lead-household-client";
import {createLeadIntentApi} from "@/lib/bo-lead-intent-api";
import {createLeadRecoveryApi} from "@/lib/bo-lead-recovery-api";
import {leadHouseholdRoute} from "@/lib/bo-lead-household-route";
import {LeadRecoveryJournal} from "./lead-recovery-journal";
const origin="https://bo.staging.pinohouse.art",prefix="/api/bo/";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function openNativeLeadAdapter(actorId:string,actualOrigin:string,storage:Pick<Storage,"getItem"|"setItem"|"removeItem">,fetcher:typeof fetch=fetch){
 if(actualOrigin!==origin||!uuid.test(actorId))throw new LeadApiError(403,"LEAD_SESSION_INVALID",null);
 const lifetime=new AbortController();
 const guardedFetch:typeof fetch=async(input,init)=>{
  lifetime.signal.throwIfAborted();
  if(typeof input!=="string"||!input.startsWith(prefix))throw new LeadApiError(403,"LEAD_ROUTE_INVALID",null);
  const url=new URL(input,origin),route=leadHouseholdRoute(url.pathname.slice(prefix.length));
  if(url.origin!==origin||!route||route.method!==init?.method||url.hash||url.username||url.password)throw new LeadApiError(403,"LEAD_ROUTE_INVALID",null);
  const headers=new Headers(init.headers);
  headers.set("x-pino-expected-actor",actorId);
  const signal=init.signal?AbortSignal.any([lifetime.signal,init.signal]):lifetime.signal;
  signal.throwIfAborted();
  const response=await fetcher(url.toString(),{...init,headers,signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
  signal.throwIfAborted();
  return response;
 };
 return {api:createLeadHouseholdApi(guardedFetch),recover:createLeadRecoveryApi(guardedFetch),intent:createLeadIntentApi(guardedFetch),journal:new LeadRecoveryJournal(storage,actorId),dispose:()=>lifetime.abort()};
}
