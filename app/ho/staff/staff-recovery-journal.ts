// PAP-2358 · WFM-STAFF. Per-tab recovery only; never store profile or credential plaintext.
// The fingerprint excludes passwords entirely. It is not authorization or a server receipt.
import {manualStaffIntent} from "@/lib/ho-manual-staff-create-flow";
import type {StaffCreateCommand} from "./manual-create-contract";
type Store=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export type StaffRecoveryRecord={v:1;key:string;centerId:string;withLogin:boolean;existingPersonId:string|null;fingerprint:string};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keyPattern=/^[a-zA-Z0-9:_-]{8,120}$/;
const fields=["v","key","centerId","withLogin","existingPersonId","fingerprint"];
function decode(raw:string):StaffRecoveryRecord{
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Staff recovery");
 const r=value as Record<string,unknown>;
 if(Object.keys(r).length!==fields.length||!fields.every(k=>Object.hasOwn(r,k))||r.v!==1||
 typeof r.key!=="string"||!keyPattern.test(r.key)||typeof r.centerId!=="string"||!id.test(r.centerId)||
 typeof r.withLogin!=="boolean"||(r.existingPersonId!==null&&(typeof r.existingPersonId!=="string"||!id.test(r.existingPersonId)))||
 typeof r.fingerprint!=="string"||!/^[0-9a-f]{64}$/.test(r.fingerprint))throw Error("Invalid Staff recovery");
 return r as StaffRecoveryRecord;
}
async function fingerprint(command:StaffCreateCommand,key:string):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(["pap2358-v1",key,manualStaffIntent(command)]));
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function createStaffRecoveryJournal(storage:Store,principalId:string){
 if(!principalId.trim()||principalId.length>200)throw Error("Invalid Staff recovery principal");
 const slot="pino:pap2358:pending:v1:"+encodeURIComponent(principalId);
 const load=()=>{const raw=storage.getItem(slot);return raw===null?null:decode(raw);};
 return {
  load,
  async prepare(command:StaffCreateCommand,key:string){
   const record=decode(JSON.stringify({v:1,key,centerId:command.centerId,withLogin:command.login!==null,existingPersonId:command.existingPersonId??null,fingerprint:await fingerprint(command,key)}));
   const prior=load();
   if(prior&&JSON.stringify(prior)!==JSON.stringify(record))throw Error("Staff recovery intent differs");
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
