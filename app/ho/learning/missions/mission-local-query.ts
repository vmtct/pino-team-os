/** PAP-2394: isolated M1 review selector, never imported by native Staging. */
export {MISSION_M1_READ,MISSION_M1_EDIT,hasMissionM1Permissions} from "./mission-m1-query";
export const MISSION_M1_ROUTE = "/ho/learning/missions";
export const MISSION_M1_ID = "MISSION-MOCK-001";
export function parseMissionM1Query(params:URLSearchParams):{record?:string}|null {
 const tracking=new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
 if([...params.keys()].some(k=>k!=="record"&&!tracking.has(k))||params.getAll("record").length>1)return null;
 const record=params.get("record");
 return record===null?{}:record===MISSION_M1_ID?{record}:null;
}
