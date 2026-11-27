// PAP-2358 · WFM-STAFF. Read-only reuse of PAP-2180; no identity inference.
import {createPersonReader,type PersonDto} from "../system/people/person-read-client";
export type StaffPersonOption={id:string;label:string};
function option(person:PersonDto):StaffPersonOption|null{
 if(person.roles.some(role=>role.kind==="STAFF"))return null;
 return {id:person.id,label:person.displayName?.trim()||"—"};
}
export function createStaffPersonReader(fetcher:typeof fetch=fetch){
 const reader=createPersonReader(fetcher);
 return {
  async search(query:string,after:string|null=null,signal?:AbortSignal){
   const q=query.trim();
   if(!q||q.length>120)throw Error("Nhập tên Person cần tìm.");
   const page=await reader.page(q,after,signal);signal?.throwIfAborted();
   return {options:page.items.flatMap(person=>{const item=option(person);return item?[item]:[];}),nextAfter:page.nextAfter};
  },
  async select(id:string,signal?:AbortSignal){
   const person=await reader.detail(id,signal);signal?.throwIfAborted();
   const selected=option(person);if(!selected)throw Error("Person đã có Staff.");
   return selected;
  },
 };
}
