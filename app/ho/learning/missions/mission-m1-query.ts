/** PAP-2394 — canonical M1-B synthetic record selection; no client preview toggle. */
export const MISSION_M1_ROUTE = "/ho/learning/missions";
export const MISSION_M1_ID = "MISSION-MOCK-001";
export const MISSION_M1_READ = "catalog.learning.view";
export const MISSION_M1_EDIT = "learning.mission.manage";
export function parseMissionM1Query(params:URLSearchParams):{record?:string}|null {
 if([...params.keys()].some(k=>k!=="record")||params.getAll("record").length>1)return null;
 const record=params.get("record");
 return record===null?{}:record===MISSION_M1_ID?{record}:null;
}
export function hasMissionM1Permissions(keys:readonly string[]):boolean {
 return keys.includes(MISSION_M1_READ)&&keys.includes(MISSION_M1_EDIT);
}
