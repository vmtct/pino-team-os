// PAP-2395 / WFM-STAFF. Server-owned deployment switch, never a URL or client flag.
// Enable only after the amended record-only Core contract is officially served.
export const STAFF_PHASE_ONE_ENABLED=false;
type Query=Record<string,string|string[]|undefined>;
const tracking=new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function parseStaffPhaseOneQuery(query:Query|URLSearchParams):{record:string|null}|null{
 const entries:Iterable<[string,string|string[]|undefined]>=query instanceof URLSearchParams?query.entries():Object.entries(query);
 let record:string|null=null;
 for(const [key,value] of entries){
  if(value===undefined||tracking.has(key))continue;
  if(key!=="record"||record!==null||typeof value!=="string"||!uuid.test(value))return null;
  record=value;
 }
 return {record};
}
export function staffPhaseOneRoute(environment:string|undefined,hostname:string,query:Query,enabled=STAFF_PHASE_ONE_ENABLED):"disabled"|"invalid"|"native"{
 if(!enabled||environment!=="staging"||hostname!=="ho.staging.pinohouse.art")return "disabled";
 return parseStaffPhaseOneQuery(query)?"native":"invalid";
}
/** Pre-stream request validation only; never proves authentication or admission. */
export function invalidStaffPhaseOneRequest(host:string,path:string,method:string,query:URLSearchParams,rsc:string|null,enabled=STAFF_PHASE_ONE_ENABLED):boolean{
 if(!enabled||host!=="ho.staging.pinohouse.art"||path!=="/ho/staff"||!["GET","HEAD"].includes(method))return false;
 const params=new URLSearchParams(query);
 if(rsc==="1")params.delete("_rsc");
 return parseStaffPhaseOneQuery(params)===null;
}
