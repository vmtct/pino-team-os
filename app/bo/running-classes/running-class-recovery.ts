/** PLT-DELIVERY / PAP-1043 / PAP-2225: same-tab mutation recovery, not a server receipt. */
import {RunningClassRejected,prepareClassCreate,type createRunningClassCommandClient,type PreparedClassCreate} from "./running-class-command-client";
import type {ClassCreate} from "./running-class-draft";
import type {ClassRecord,ClassEditCommand} from "./running-class-presentation";
type Client=ReturnType<typeof createRunningClassCommandClient>;
type Pending={kind:"create";attempt:PreparedClassCreate;receipt?:ClassRecord}|{kind:"edit";original:ClassRecord;command:ClassEditCommand;receipt?:ClassRecord};
type StoragePort=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export async function runningClassJournalScope(actorId:string,centerId:string){
 if(!actorId||!centerId)throw Error("Unverified Running Class scope.");
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(["running-class",actorId,centerId])));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
export function createRunningClassRecovery(options:{centerId:string;scope:string;storage:StoragePort;verify:()=>Promise<void>;client:Client;newKey?:()=>string}){
 if(!/^[0-9a-f]{64}$/.test(options.scope))throw Error("Invalid Running Class journal scope.");
 const slot="pino:running-class:pending:v1:"+options.scope;
 let pending:Pending|undefined,marker:string|undefined,busy=false,disposed=false;
 const read=()=>options.storage.getItem(slot);
 const ensure=async()=>{if(disposed)throw Error("Running Class session closed.");await options.verify();if(disposed)throw Error("Running Class session closed.");};
 const exclusive=async<T>(fn:()=>Promise<T>):Promise<T>=>{
  if(busy||disposed)throw Error("Running Class operation already active.");
  busy=true;try{return await fn();}finally{busy=false;}
 };
 const reserve=(p:Pending)=>{
  if(pending||read()!==null)throw Error("Unresolved Running Class operation.");
  const key=crypto.randomUUID();options.storage.setItem(slot,key);
  if(read()!==key)throw Error("Running Class journal unavailable.");
  marker=key;pending=p;
 };
 const owned=()=>{if(!marker||read()!==marker||!pending)throw Error("Running Class operation cannot be recovered.");return pending;};
 const clear=()=>{owned();options.storage.removeItem(slot);if(read()!==null)throw Error("Running Class journal not cleared.");pending=undefined;marker=undefined;};
 async function execute(initial:boolean){
  const p=owned();await ensure();
  const record=(r:ClassRecord)=>{p.receipt=Object.freeze({...r});};
  let result:ClassRecord;
  try{
   if(p.receipt)result=await options.client.readback(p.receipt);
   else if(p.kind==="create")result=await options.client.create(p.attempt,record);
   else if(initial)result=await options.client.edit(p.original,p.command,record);
   else throw Error("Unconfirmed inline edit requires reconciliation; no write retry.");
  }catch(e){
   // A rejection only settles a first command with no previously confirmed or uncertain write.
   if(initial&&!p.receipt&&e instanceof RunningClassRejected){await ensure();clear();}
   throw e;
  }
  await ensure();clear();return result;
 }
 return {
  state(){return {busy,pending:read()!==null,recovery:pending?.receipt?"READBACK":pending?.kind==="create"?"SAME_CREATE":read()!==null?"RECONCILE":"NONE"} as const;},
  create(command:ClassCreate){return exclusive(async()=>{await ensure();const attempt=prepareClassCreate(options.centerId,command,(options.newKey??(()=>crypto.randomUUID()))());reserve({kind:"create",attempt});return execute(true);});},
  edit(original:ClassRecord,command:ClassEditCommand){return exclusive(async()=>{await ensure();if(original.centerId!==options.centerId||command.id!==original.id||command.expectedVersion!==original.version)throw Error("Stale Running Class intent.");reserve({kind:"edit",original:Object.freeze({...original}),command:Object.freeze({...command,changes:Object.freeze({...command.changes})})});return execute(true);});},
  retry(){return exclusive(()=>execute(false));},
  dispose(){disposed=true;pending=undefined;marker=undefined;}
 };
}
