// PAP-784 / WFM-STAFF. Pure M1 presentation model; no transport, credentials or live ACL.
export type AccountStatus="missing"|"inactive"|"active"|"unknown";
export type Scope={type:"GLOBAL";id:null}|{type:"CENTER";id:string};
export type RoleChoice={id:string;label:string;active:boolean;protected:boolean;scopes:readonly Scope["type"][]};
export type CenterChoice={id:string;label:string;active:boolean};
export type Assignment={id:string;roleId:string;scope:Scope;protected:boolean};
export type Snapshot={staffId:string;revision:number;employment:"inactive"|"active";accountStatus:AccountStatus;accountId:string|null;affiliationIds:readonly string[];assignments:readonly Assignment[]};
export type Draft={staffId:string;revision:number;roleId:string;scope:Scope};
export type PresentationResult={kind:"ready";draft:Draft}|{kind:"invalid"|"denied"|"stale"|"duplicate"};
export function prepareAssignment(snapshot:Snapshot,draft:Draft,roles:readonly RoleChoice[],centers:readonly CenterChoice[]):PresentationResult{
 if(snapshot.staffId!==draft.staffId||snapshot.revision!==draft.revision)return {kind:"stale"};
 if(snapshot.accountStatus!=="active"||!snapshot.accountId)return {kind:"denied"};
 const role=roles.find(r=>r.id===draft.roleId);
 if(!role?.active||role.protected||!role.scopes.includes(draft.scope.type))return {kind:"denied"};
 if(draft.scope.type==="CENTER"&&!centers.some(c=>c.id===draft.scope.id&&c.active))return {kind:"invalid"};
 if(draft.scope.type==="GLOBAL"&&draft.scope.id!==null)return {kind:"invalid"};
 if(snapshot.assignments.some(a=>a.roleId===draft.roleId&&a.scope.type===draft.scope.type&&a.scope.id===draft.scope.id))return {kind:"duplicate"};
 return {kind:"ready",draft:structuredClone(draft)};
}
export function prepareRemoval(snapshot:Snapshot,request:{staffId:string;revision:number;assignmentId:string}):{kind:"ready";assignmentId:string}|{kind:"stale"|"denied"}{
 if(snapshot.staffId!==request.staffId||snapshot.revision!==request.revision)return {kind:"stale"};
 const item=snapshot.assignments.find(a=>a.id===request.assignmentId);
 if(snapshot.accountStatus!=="active"||!snapshot.accountId||!item||item.protected)return {kind:"denied"};
 return {kind:"ready",assignmentId:item.id};
}
export function accountPresentation(snapshot:Snapshot,centers:readonly CenterChoice[]){
 return {employment:snapshot.employment,accountStatus:snapshot.accountStatus,affiliations:snapshot.affiliationIds.map(id=>({id,label:centers.find(c=>c.id===id)?.label??"Chưa xác minh",active:centers.some(c=>c.id===id&&c.active)})),assignments:structuredClone(snapshot.assignments),operationalReadiness:snapshot.employment==="inactive"||snapshot.accountStatus!=="active"?"not-ready":"unverified"} as const;
}
