/** PAP-2180: complete bounded snapshot for native local Table filters/sorts. Never label a partial directory as complete. */
import {createPersonReader,type PersonDto} from "./person-read-client";
import type {PersonRow} from "./HoPersonDirectory";

type Reader=ReturnType<typeof createPersonReader>;
export function personRow(p:PersonDto):PersonRow{
 const labels={STUDENT:"Student",STAFF:"Staff",PARENT:"Parent",GUEST:"MyTime Guest"};
 const label=(kind:"STUDENT"|"STAFF"|"PARENT"|"GUEST")=>{const role=p.roles.find(r=>r.kind===kind);return role?(role.displayName??role.id):null;};
 return {id:p.id,name:p.displayName??p.id,roles:p.roles.map(r=>labels[r.kind]),identityState:p.roles.length?"Linked":"Unlinked",avatarState:p.avatar.status,student:label("STUDENT"),staff:label("STAFF"),guest:label("GUEST"),parent:label("PARENT"),avatarId:p.avatar.id,nickname:p.avatar.nickname,createdAt:p.createdAt,updatedAt:p.updatedAt,createdBy:p.createdBy,updatedBy:p.updatedBy};
}
export async function loadPersonDirectory(reader:Pick<Reader,"page"|"unlinkedCounts">,signal:AbortSignal){
 const items:PersonDto[]=[];let after:string|null=null;
 // Native Table applies search, filters and sort to the whole authorized set.
 // Fail visibly instead of returning a truncated set at the safety limit.
 for(let i=0;i<100;i++){
  signal.throwIfAborted();
  const page=await reader.page("",after,signal);
  if(after&&page.items.some(p=>p.id<=after!)||page.nextAfter!==null&&page.nextAfter<= (after??""))throw Error("Invalid directory traversal");
  items.push(...page.items);
  if(page.nextAfter===null){
   const counts=await reader.unlinkedCounts(signal);signal.throwIfAborted();
   return {rows:items.map(personRow),counts};
  }
  after=page.nextAfter;
 }
 throw Error("Person directory exceeds local table limit");
}
