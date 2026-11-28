// PAP-784: strictly isolated M1 fixture port. No transport, credential or actual assignment.
import type {StaffAccessPort} from "./StaffAccessControls";
import {applyAccessScenario,type ScenarioCommand} from "./staff-access-scenario";
import {verifyAccessReadback} from "./staff-access-readback";
import type {Snapshot,RoleChoice,CenterChoice,ScopeTarget} from "./staff-access-presentation-model";
export function createStaffAccessFixturePort(seed:Snapshot,roles:readonly RoleChoice[],centers:readonly CenterChoice[],targets:readonly ScopeTarget[]):StaffAccessPort{
 let state=structuredClone(seed);const catalog=structuredClone(roles),centerCatalog=structuredClone(centers),targetCatalog=structuredClone(targets);
 return {
 async apply(request){
  if(request.staffId!==state.staffId||request.accountId!==state.accountId)return "denied";
  if(request.revision!==state.revision)return "stale";
  if(state.accountStatus!=="active"||!state.accountId)return "denied";
  const change=request.change,identity={staffId:state.staffId,revision:state.revision};
  const command:ScenarioCommand=change.kind==="assign"?{kind:"assign",draft:{...identity,roleId:change.roleId,scope:change.scope}}:{kind:"remove",...identity,assignmentId:change.assignmentId};
  const result=applyAccessScenario(state,command,catalog,centerCatalog,targetCatalog);
  if(result.kind==="stale")return "stale";
  if(result.kind!=="saved")return "denied";
  if(!verifyAccessReadback(state,change,result.snapshot))return "unknown";
  state=structuredClone(result.snapshot);return "acknowledged";
 },
 async readback(staffId){return staffId===state.staffId?structuredClone(state):null;}
 };
}
