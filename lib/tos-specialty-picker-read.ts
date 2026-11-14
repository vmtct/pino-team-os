/** PAP-1497 / PAP-1491 SPEC-UNLOCK. Read-only picker data for the coordinated S4 cutover.
 * No write permit. Existing Assignment/Diary callers must retain their own
 * server-side guards and must not mount this reader until the cutover is proven.
 */
import {readTosEligibleMissions} from "./tos-mission-assignment-choices";
import type {TosMissionAssignmentScope} from "./tos-mission-assignment-api";
import {
  filterTosScopedMissions,validateTosScopedMissionChoices,
  type TosScopedMissionChoice,
} from "./tos-specialty-mission-availability";

export type SpecialtyPickerScope=TosMissionAssignmentScope & {pathProgramId:string};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Assemble the full, exact scope before showing any selectable choice.
 * Calling the existing transport preserves its auth/error/page/duplicate contract.
 * Never combine old eligible-only and new all/locked pages into a partial list.
 */
export async function readTosSpecialtyPickerChoices(
 scope:SpecialtyPickerScope,transport:typeof fetch=(...args)=>fetch(...args),
):Promise<readonly TosScopedMissionChoice[]>{
 if(!scope||typeof scope.pathProgramId!=="string"||!id.test(scope.pathProgramId))
  throw new TypeError("SPECIALTY_PICKER_PATH_UNVERIFIED");
 const raw=await readTosEligibleMissions({...scope},transport);
 const choices=validateTosScopedMissionChoices(raw);
 for(const [index,choice] of choices.entries()){
  const entry=raw[index];
  if(!entry)throw new TypeError("SPECIALTY_PICKER_EVIDENCE_MISSING");
  // Core PR2141 preserves definition-only readiness; a true definition
  // verdict alone is not permission to select a locked Specialty Mission.
  const ready=entry.assignmentDefinitionEligible;
  const reason=entry.assignmentDefinitionBlockReason;
  if(typeof ready!=="boolean"||
     (ready&&reason!==null)||
     (!ready&&reason!=="MISSION_INELIGIBLE"&&reason!=="PREREQUISITE_PROOF_UNAVAILABLE")||
     (choice.available&&!ready))
   throw new TypeError("SPECIALTY_PICKER_DEFINITION_CONFLICT");
  if(reason==="PREREQUISITE_PROOF_UNAVAILABLE"&&
     !choice.lockReasons.some(lock=>lock.code==="MISSION_PREREQUISITE_INCOMPLETE"))
   throw new TypeError("SPECIALTY_PICKER_PREREQUISITE_EVIDENCE_MISSING");
 }
 return filterTosScopedMissions(choices);
}
