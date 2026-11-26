// PAP-2395 · WFM-STAFF. Opaque per-tab marker, no profile-derived digest.
// After reload only authoritative receipt readback is permitted.
import type {StaffCreateCommand} from "./manual-create-contract";
type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export type StaffRecoveryRecord={v:2;key:string;centerId:string};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keyPattern=/^[a-zA-Z0-9:_-]{8,120}$/;
function decode(raw:string):StaffRecoveryRecord{
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Staff recovery");
 const r=value as Record<string,unknown>;
 if(Object.keys(r).length!==3||r.v!==2||typeof r.key!=="string"||!keyPattern.test(r.key)||typeof r.centerId!=="string"||!id.test(r.centerId))throw Error("Invalid Staff recovery");
 return {v:2,key:r.key,centerId:r.centerId};
}
export function createStaffRecoveryJournal(storage:Store,principalId:string){
 if(!principalId.trim()||principalId.length>200)throw Error("Invalid Staff recovery principal");
 const slot="pino:pap2358:pending:v1:"+encodeURIComponent(principalId);
 const load=()=>{const raw=storage.getItem(slot);return raw===null?null:decode(raw);};
 return {
  load,
  prepare(command:StaffCreateCommand,key:string){
   if(command.login!==null)throw Error("Staff provisioning not admitted");
   const record=decode(JSON.stringify({v:2,key,centerId:command.centerId}));
   const prior=load();
   if(prior&&JSON.stringify(prior)!==JSON.stringify(record))throw Error("Staff recovery scope differs");
   storage.setItem(slot,JSON.stringify(record));
   if(JSON.stringify(load())!==JSON.stringify(record))throw Error("Staff recovery not saved");
   return record;
  },
  clear(key:string){
   const prior=load();if(prior&&prior.key!==key)throw Error("Staff recovery key differs");
   storage.removeItem(slot);if(load()!==null)throw Error("Staff recovery not cleared");
  },
 };
}
export type StaffRecoveryJournal=ReturnType<typeof createStaffRecoveryJournal>;