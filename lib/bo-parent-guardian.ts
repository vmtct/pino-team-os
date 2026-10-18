/** PAP-739: typed BO client contract. All writes need server-side auth + atomic Audit. */
export type ParentContactKind = "PHONE"|"EMAIL";
export type GuardianRole = "PARENT"|"GUARDIAN"|"OTHER";
export interface ParentDirectoryRow {
  id:string; displayName:string; version:number; linkedStudentCount:number;
  maskedContact:string|null; attention:"MISSING_CONTACT"|"NO_STUDENT"|null;
}
export interface ParentContact {
  id:string; type:ParentContactKind; maskedValue:string; primary:boolean; verified:boolean;
}
export interface ParentStudentLink {
  id:string; studentId:string; studentName:string; role:GuardianRole; version:number; centerName:string|null;
}
export interface ParentAuditEvent {
  id:string; action:string; occurredAt:string; actorLabel:string; reason:string;
  before?:unknown; after?:unknown;
}
export interface ParentDetail {
  id:string; displayName:string; version:number; status:"ACTIVE"|"ARCHIVED";
  students:ParentStudentLink[]; contacts:ParentContact[];
  access:{canManage:boolean;canRevealContact:boolean;canCreate:boolean};
}
export interface ParentDirectoryPage { items:ParentDirectoryRow[]; nextCursor:string|null }
export type ParentCommandResult = { parentId:string; version:number };
export class ParentApiError extends Error {
  constructor(readonly status:number, message:string){super(message);this.name="ParentApiError";}
}
async function request<T>(path:string, options:RequestInit={}):Promise<T>{
  const response=await fetch(`/api/bo/identity/parents-directory${path}`,{...options,cache:"no-store"});
  let payload:{data?:T;error?:{message?:string}};
  try{payload=await response.json() as typeof payload;}catch{throw new ParentApiError(response.status,"Invalid BO response");}
  if(!response.ok||payload.data===undefined)throw new ParentApiError(response.status,payload.error?.message??"BO Parent command failed");
  return payload.data;
}
const encode=(value:string)=>encodeURIComponent(value);
async function write<T>(method:"POST"|"PATCH"|"DELETE",path:string,body:unknown){
  return request<T>(path,{method,headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)});
}
export const parentApi={
  list:(query="",beforeParentId?:string)=>request<ParentDirectoryPage>(`?query=${encode(query)}&limit=25${beforeParentId?`&beforeParentId=${encode(beforeParentId)}`:""}`),
  detail:(id:string)=>request<ParentDetail>(`/${encode(id)}`),
  audit:(id:string)=>request<ParentAuditEvent[]>(`/${encode(id)}/audit`),
  create:(displayName:string,contact?:{type:ParentContactKind;value:string},reason?:string)=>write<ParentCommandResult>("POST","",{displayName,contact,reason}),
  rename:(id:string,displayName:string,version:number,reason:string)=>write<ParentCommandResult>("PATCH",`/${encode(id)}`,{displayName,expectedVersion:version,reason}),
  addContact:(id:string,kind:ParentContactKind,value:string,reason:string)=>write<ParentCommandResult>("POST",`/${encode(id)}/contacts`,{kind,value,reason}),
  retireContact:(id:string,contactId:string,reason:string)=>write<ParentCommandResult>("POST",`/${encode(id)}/contacts/${encode(contactId)}/retire`,{reason}),
  link:(id:string,studentId:string,role:GuardianRole,reason:string)=>write<ParentCommandResult>("POST",`/${encode(id)}/students`,{studentId,role,reason}),
  unlink:(id:string,linkId:string,version:number,reason:string)=>write<ParentCommandResult>("POST",`/${encode(id)}/students/${encode(linkId)}/unlink`,{expectedVersion:version,reason}),
};
