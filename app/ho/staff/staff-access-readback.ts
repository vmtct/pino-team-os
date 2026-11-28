// PAP-784 / WFM-STAFF. Pure record-bound readback contract; no transport.
import type {Snapshot,Assignment,Scope} from "./staff-access-presentation-model";
export type AccessChange={kind:"assign";roleId:string;scope:Scope}|{kind:"remove";assignmentId:string};
const equalScope=(a:Scope,b:Scope)=>a.type===b.type&&a.id===b.id;
const equalAssignment=(a:Assignment,b:Assignment)=>a.id===b.id&&a.roleId===b.roleId&&equalScope(a.scope,b.scope)&&a.protected===b.protected;
function sameSet(a:readonly string[],b:readonly string[]){return new Set(a).size===a.length&&new Set(b).size===b.length&&a.length===b.length&&a.every(x=>b.includes(x));}
export function verifyAccessReadback(before:Snapshot,change:AccessChange,after:Snapshot):boolean{
 if(!before.accountId||before.accountStatus!=="active"||after.staffId!==before.staffId||after.accountId!==before.accountId||after.accountStatus!==before.accountStatus||after.employment!==before.employment||!Number.isSafeInteger(before.revision)||!Number.isSafeInteger(after.revision)||after.revision<=before.revision||!sameSet(before.affiliationIds,after.affiliationIds))return false;
 if(new Set(before.assignments.map(a=>a.id)).size!==before.assignments.length||new Set(after.assignments.map(a=>a.id)).size!==after.assignments.length)return false;
 if(change.kind==="assign"){
  if(before.assignments.some(a=>a.roleId===change.roleId&&equalScope(a.scope,change.scope)))return false;
  const additions=after.assignments.filter(a=>!before.assignments.some(b=>b.id===a.id));
  return after.assignments.length===before.assignments.length+1&&additions.length===1&&!!additions[0]?.id&&!additions[0].protected&&additions[0].roleId===change.roleId&&equalScope(additions[0].scope,change.scope)&&before.assignments.every(a=>after.assignments.some(b=>equalAssignment(a,b)));
 }
 const removed=before.assignments.find(a=>a.id===change.assignmentId);
 return !!removed&&!removed.protected&&after.assignments.length===before.assignments.length-1&&!after.assignments.some(a=>a.id===change.assignmentId)&&before.assignments.filter(a=>a.id!==change.assignmentId).every(a=>after.assignments.some(b=>equalAssignment(a,b)));
}
