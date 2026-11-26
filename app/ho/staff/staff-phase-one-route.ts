// PAP-2395 / WFM-STAFF. Server-owned deployment switch, never a URL or client flag.
// Enable only after the amended record-only Core contract is officially served.
export const STAFF_PHASE_ONE_ENABLED=false;
type Query=Record<string,string|string[]|undefined>;
const tracking=new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function staffPhaseOneRoute(environment:string|undefined,hostname:string,query:Query,enabled=STAFF_PHASE_ONE_ENABLED):"disabled"|"invalid"|"native"{
 if(!enabled||environment!=="staging"||hostname!=="ho.staging.pinohouse.art")return "disabled";
 for(const [key,value] of Object.entries(query)){
  if(value===undefined)continue;
  if(tracking.has(key))continue;
  if(key!=="record"||typeof value!=="string"||!uuid.test(value))return "invalid";
 }
 return "native";
}