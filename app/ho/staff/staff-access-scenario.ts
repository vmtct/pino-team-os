// PAP-784 / WFM-STAFF. Isolated scenario, never a live Staff or Access mutation.
import {prepareAssignment,prepareRemoval,type Snapshot,type Draft,type RoleChoice,type CenterChoice} from "./staff-access-presentation-model";
export type ScenarioCommand={kind:"assign";draft:Draft}|{kind:"remove";staffId:string;revision:number;assignmentId:string}|{kind:"affiliate"|"unaffiliate";staffId:string;revision:number;centerId:string};
export type ScenarioResult={kind:"saved";snapshot:Snapshot}|{kind:"invalid"|"denied"|"stale"|"duplicate"};
export function applyAccessScenario(s:Snapshot,command:ScenarioCommand,roles:readonly RoleChoice[],centers:readonly CenterChoice[]):ScenarioResult{
 if(command.kind==="assign"){
  const checked=prepareAssignment(s,command.draft,roles,centers);if(checked.kind!=="ready")return checked;
  const d=checked.draft;
  return {kind:"saved",snapshot:{...structuredClone(s),revision:s.revision+1,assignments:[...structuredClone(s.assignments),{id:"M1-ASSIGNMENT-"+(s.revision+1),roleId:d.roleId,scope:d.scope,protected:false}]}};
 }
 if(command.staffId!==s.staffId||command.revision!==s.revision)return {kind:"stale"};
 if(command.kind==="remove"){
  const checked=prepareRemoval(s,command);if(checked.kind!=="ready")return checked;
  return {kind:"saved",snapshot:{...structuredClone(s),revision:s.revision+1,assignments:s.assignments.filter(a=>a.id!==checked.assignmentId)}};
 }
 if(command.kind==="affiliate"){
  if(!centers.some(c=>c.id===command.centerId&&c.active))return {kind:"invalid"};
  if(s.affiliationIds.includes(command.centerId))return {kind:"duplicate"};
  return {kind:"saved",snapshot:{...structuredClone(s),revision:s.revision+1,affiliationIds:[...s.affiliationIds,command.centerId]}};
 }
 if(!s.affiliationIds.includes(command.centerId)||s.affiliationIds.length<=1)return {kind:"denied"};
 return {kind:"saved",snapshot:{...structuredClone(s),revision:s.revision+1,affiliationIds:s.affiliationIds.filter(id=>id!==command.centerId)}};
}
