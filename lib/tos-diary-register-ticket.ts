/** PAP-1400 — opaque per-tab Register ticket. No Student/Center/notes/photo in browser storage.
 * Core keeps the durable idempotency receipt; this is only the original client key.
 * Missing/corrupt/blocked storage must fail CLOSED, never create a fresh Diary blindly.
 */
export const DIARY_REGISTER_TICKET_KEY="pino.pap1400.diary-register-ticket.v1";
export type DiaryTicketStorage=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export type DiaryTicketState=
 |{state:"EMPTY";key:null}
 |{state:"PENDING";key:string}
 |{state:"UNAVAILABLE";key:null};
const unavailable=():DiaryTicketState=>({state:"UNAVAILABLE",key:null});
export const isOpaqueSubmissionKey=(value:unknown):value is string=>
 typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Does not clear corrupt or stale tickets; staff must not accidentally Register again. */
export function readDiaryTicket(storage:DiaryTicketStorage|null|undefined):DiaryTicketState{
 if(!storage)return unavailable();
 try{
  const key=storage.getItem(DIARY_REGISTER_TICKET_KEY);
  if(key===null)return {state:"EMPTY",key:null};
  return isOpaqueSubmissionKey(key)?{state:"PENDING",key}:unavailable();
 }catch{return unavailable();}
}

/** Must execute synchronously BEFORE first Register network command. */
export function stageDiaryTicket(storage:DiaryTicketStorage|null|undefined,key:string):boolean{
 if(!isOpaqueSubmissionKey(key)||readDiaryTicket(storage).state!=="EMPTY")return false;
 try{
  storage!.setItem(DIARY_REGISTER_TICKET_KEY,key);
  const actual=readDiaryTicket(storage);
  return actual.state==="PENDING"&&actual.key===key;
 }catch{return false;}
}

/** Only a confirmed source receipt may release this specific ticket.
 * Never clear on 404/409/503, a lost ACK, or incomplete Mission links.
 */
export function clearVerifiedDiaryTicket(storage:DiaryTicketStorage|null|undefined,key:string):boolean{
 const actual=readDiaryTicket(storage);
 if(actual.state!=="PENDING"||actual.key!==key)return false;
 try{
  storage!.removeItem(DIARY_REGISTER_TICKET_KEY);
  return readDiaryTicket(storage).state==="EMPTY";
 }catch{return false;}
}
