// PAP-784 / PAP-2430 — local hypothetical account state only, no transport.
import {prepareAssignment,type Snapshot,type RoleChoice,type CenterChoice,type ScopeTarget} from "./staff-access-presentation-model";
export type AccountInlineSample={snapshot:Snapshot;loginEmail:string};
export type AccountInlineField="accountStatus"|"loginEmail"|"role";
export function applyAccountInlineSample(state:AccountInlineSample,request:{staffId:string;accountId:string|null;revision:number;field:AccountInlineField;value:unknown},roles:readonly RoleChoice[],centers:readonly CenterChoice[],targets:readonly ScopeTarget[]):AccountInlineSample|null{
 const s=state.snapshot;
 if(!/^STAFF-MOCK-\d{3,}$/.test(s.staffId)||s.accountId!=="M1-HYPOTHETICAL-ACCOUNT:"+s.staffId||request.staffId!==s.staffId||request.accountId!==s.accountId||request.revision!==s.revision||!["active","inactive"].includes(s.accountStatus)||s.assignments.some(a=>a.protected))return null;
 const v=request.value;
 if(request.field==="accountStatus"){
  if(v!=="active"&&v!=="inactive")return null;
  if(v===s.accountStatus)return state;
  return {...state,snapshot:{...s,accountStatus:v,revision:s.revision+1}};
 }
 if(request.field==="loginEmail"){
  if(typeof v!=="string"||v.length>254||!/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$/i.test(v))return null;
  if(v===state.loginEmail)return state;
  return {loginEmail:v,snapshot:{...s,revision:s.revision+1}};
 }
 if(request.field!=="role"||s.accountStatus!=="active"||s.assignments.length!==1||typeof v!=="string")return null;
 const current=s.assignments[0]!;
 if(current.roleId===v)return state;
 const checked=prepareAssignment(s,{staffId:s.staffId,revision:s.revision,roleId:v,scope:current.scope},roles,centers,targets);
 if(checked.kind!=="ready")return null;
 return {...state,snapshot:{...s,revision:s.revision+1,assignments:[{...current,roleId:v}]}};
}
