/** PAP-1497 / SPEC-UNLOCK S4 — TOS view-model only, never an access policy. */
/** The current Diary writer consumes the legacy eligible-only contract. Until the
 * source-owned S4 write guard is integrated, never feed an all/locked projection
 * into that writer, even if its display DTO validates. Legacy reads stay intact. */
export function requiresSpecialtySelectionGuard(items: unknown): boolean {
  return !Array.isArray(items) || items.some(item => !item || typeof item !== "object" ||
    "available" in item || "lockReasons" in item);
}

export type TosMissionAvailabilityFilter = "all" | "available" | "locked";
export type TosMissionLockReasonCode =
  | "NO_EFFECTIVE_SPECIALTY_GRANT"
  | "FUTURE_START_DATE"
  | "PREREQUISITE_SPECIALTY_INCOMPLETE"
  | "MISSION_PREREQUISITE_INCOMPLETE";
export type TosMissionLockReason = { code: TosMissionLockReasonCode; relatedId?: string };
export interface TosScopedMissionChoice {
  missionId: string;
  code: string;
  name: string;
  level: number;
  assignmentId: string | null;
  available: boolean;
  lockReasons: readonly TosMissionLockReason[];
}
const labels: Record<TosMissionLockReasonCode,string> = {
  NO_EFFECTIVE_SPECIALTY_GRANT:"Chuyên đề chưa được mở khóa",
  FUTURE_START_DATE:"Chuyên đề chưa đến ngày hiệu lực",
  PREREQUISITE_SPECIALTY_INCOMPLETE:"Chưa hoàn thành chuyên đề tiên quyết",
  MISSION_PREREQUISITE_INCOMPLETE:"Chưa hoàn thành nhiệm vụ tiên quyết",
};
const codes = new Set<string>(Object.keys(labels));
function normalized(value:string):string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").trim().toLocaleLowerCase("vi");
}
/** Fail closed rather than silently making legacy /eligible rows selectable. */
export function validateTosScopedMissionChoices(payload:unknown):TosScopedMissionChoice[] {
  if(!Array.isArray(payload))throw new TypeError("MISSING_SCOPED_MISSIONS");
  const ids=new Set<string>();
  return payload.map(row=>{
    if(!row||typeof row!=="object"||Array.isArray(row))throw new TypeError("MISSION_ROW_INVALID");
    const item=row as Record<string,unknown>;
    if(typeof item.missionId!=="string"||!item.missionId.trim()||
       typeof item.code!=="string"||!item.code.trim()||
       typeof item.name!=="string"||!item.name.trim()||
       typeof item.level!=="number"||!Number.isSafeInteger(item.level)||
       (item.assignmentId!==null&&typeof item.assignmentId!=="string")||
       typeof item.available!=="boolean"||!Array.isArray(item.lockReasons))
      throw new TypeError("MISSION_AVAILABILITY_CONTRACT_INVALID");
    if(ids.has(item.missionId))throw new TypeError("DUPLICATE_MISSION_ID");
    ids.add(item.missionId);
    const reasons=(item.lockReasons as unknown[]).map(r=>{
      if(!r||typeof r!=="object"||Array.isArray(r))throw new TypeError("LOCK_REASON_INVALID");
      const raw=r as Record<string,unknown>;
      if(typeof raw.code!=="string"||!codes.has(raw.code)||
         (raw.relatedId!==undefined&&(typeof raw.relatedId!=="string"||!raw.relatedId.trim())))
        throw new TypeError("LOCK_REASON_INVALID");
      return {code:raw.code as TosMissionLockReasonCode,...(raw.relatedId?{relatedId:raw.relatedId as string}:{})};
    });
    if(item.available!== (reasons.length===0))
      throw new TypeError("MISSION_AVAILABILITY_CONFLICT");
    return {
      missionId:item.missionId,code:item.code,name:item.name,level:item.level,
      assignmentId:item.assignmentId as string|null,available:item.available,lockReasons:reasons,
    };
  });
}
export function filterTosScopedMissions(
  items:readonly TosScopedMissionChoice[],
  filter:TosMissionAvailabilityFilter="all",
  query="",
):TosScopedMissionChoice[]{
  const q=normalized(query);
  return items.filter(item=>
    (filter==="all"||(filter==="available"?item.available:!item.available))&&
    (!q||normalized(item.code).includes(q)||normalized(item.name).includes(q))
  ).sort((a,b)=>Number(b.available)-Number(a.available)||
     a.code.localeCompare(b.code,"vi")||a.missionId.localeCompare(b.missionId));
}
export function describeTosMissionLocks(item:TosScopedMissionChoice):string[]{
  return item.lockReasons.map(reason=>labels[reason.code]+(reason.relatedId?" · "+reason.relatedId:""));
}
