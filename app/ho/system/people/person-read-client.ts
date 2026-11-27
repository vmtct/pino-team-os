/** PAP-2180 — HO Person read-only client; never infer identity from matching names. */
export type PersonRole={kind:"STUDENT"|"STAFF"|"PARENT"|"GUEST";id:string;displayName:string|null;status:string|null};
export type PersonDto={id:string;displayName:string|null;roles:PersonRole[];avatar:{id:string|null;status:"SELF_MISSING"|"NEEDS_REPAIR"|"NOT_STARTED"|"IN_PROGRESS"|"READY";selfStatus:"ACTIVE"|"ARCHIVED"|null;nickname:string|null};createdAt:string;updatedAt:string;createdBy:string|null;updatedBy:string|null;version:number};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=():never=>{throw new Error("Invalid Person projection");};
const obj=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const id=(v:unknown)=>typeof v==="string"&&ID.test(v)?v:fail();
const nullable=(v:unknown)=>v===null?null:typeof v==="string"?v:fail();
const date=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:fail();
const oneOf=<T extends string>(v:unknown,values:readonly T[]):T=>typeof v==="string"&&values.includes(v as T)?v as T:fail();
export function decodePerson(value:unknown):PersonDto{
 const r=obj(value),a=obj(r.avatar);
 if(!Array.isArray(r.roles))fail();
 const roles=(r.roles as unknown[]).map(v=>{const o=obj(v);return {kind:oneOf(o.kind,["STUDENT","STAFF","PARENT","GUEST"] as const),id:id(o.id),displayName:nullable(o.displayName),status:nullable(o.status)};});
 if(new Set(roles.map(x=>x.kind)).size!==roles.length)fail();
 const self=a.id===null?null:id(a.id);
 const status=oneOf(a.status,["SELF_MISSING","NEEDS_REPAIR","NOT_STARTED","IN_PROGRESS","READY"] as const);
 const selfStatus=a.selfStatus===null?null:oneOf(a.selfStatus,["ACTIVE","ARCHIVED"] as const);
 if((self===null)!==(status==="SELF_MISSING")||(self===null)!==(selfStatus===null))fail();
 if(typeof r.version!=="number"||!Number.isSafeInteger(r.version)||r.version<1)fail();
 return {id:id(r.id),displayName:nullable(r.displayName),roles,avatar:{id:self,status,selfStatus,nickname:nullable(a.nickname)},createdAt:date(r.createdAt),updatedAt:date(r.updatedAt),createdBy:nullable(r.createdBy),updatedBy:nullable(r.updatedBy),version:r.version as number};
}
export function decodePersonPage(value:unknown){
 const r=obj(value);
 if(!Array.isArray(r.items)||r.items.length>100)fail();
 const items=(r.items as unknown[]).map(decodePerson);
 const nextAfter=r.nextAfter===null?null:id(r.nextAfter);
 if(new Set(items.map(x=>x.id)).size!==items.length||items.some((x,i)=>i>0&&x.id<=items[i-1]!.id)||nextAfter!==null&&nextAfter!==items.at(-1)?.id)fail();
 return {items,nextAfter};
}
export function decodeUnlinkedCounts(value:unknown){
 const r=obj(value);
 for(const n of [r.students,r.staff])if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0)fail();
 if(r.parents!==undefined&&(typeof r.parents!=="number"||!Number.isSafeInteger(r.parents)||r.parents<0))fail();
 return {students:r.students as number,staff:r.staff as number,...(r.parents===undefined?{}:{parents:r.parents as number})};
}
export class PersonReadError extends Error{constructor(readonly status:number){super("Person read unavailable");}}
export function createPersonReader(fetcher:typeof fetch=fetch){
 const read=async(path:string,signal?:AbortSignal)=>{const res=await fetcher("/api/ho/identity/persons"+path,{method:"GET",cache:"no-store",credentials:"same-origin",signal,headers:{accept:"application/json"}});if(!res.ok)throw new PersonReadError(res.status);return obj(await res.json()).data;};
 return {
  async page(q="",after:string|null=null,signal?:AbortSignal){if(q.length>120)fail();const params=new URLSearchParams({limit:"100",q});if(after)params.set("after",id(after));const page=decodePersonPage(await read("?"+params,signal));if(after&&page.items.some(x=>x.id<=after))fail();return page;},
  async detail(personId:string,signal?:AbortSignal){const p=decodePerson(await read("/"+id(personId),signal));if(p.id!==personId)fail();return p;},
  async unlinkedCounts(signal?:AbortSignal){return decodeUnlinkedCounts(await read("/unlinked-counts",signal));},
 };
}
