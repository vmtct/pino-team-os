/** PAP-2288 / PLT-LEAD: opaque per-tab recovery metadata, never a command payload or authority. */
import type {LeadCommand} from "./lead-household-provider";
import type {LeadReceipt,LeadDetail} from "@/lib/bo-lead-household-client";
import {parseLeadRecoveryInput,parseLeadRecoveryReceipt,type LeadRecoveryInput,type LeadRecoveryReceipt} from "@/lib/bo-lead-recovery-api";
import {parseIntentRecovery,parseIntentReceipt,type IntentAction,type IntentTarget,type IntentRecovered} from "@/lib/bo-lead-intent-api";
type StoragePort=Pick<Storage,"getItem"|"setItem"|"removeItem">;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set<string>(["create","contact","addMember","updateMember","retireMember","primary","addRelation","updateRelation","confirmRelation","retireRelation","archive"]);
type Entry={schema:1;scope:string;key:string;kind:LeadCommand["kind"];target:string|null;expectedVersion:number|null;receipt:LeadReceipt|null};
export type IntentEntry={schema:1;scope:string;kind:"intent";target:string;intentId:string;action:IntentAction;key:string;expectedVersion:number};
type View={state:"intent_unknown";entry:IntentEntry}|{state:"empty"}|{state:"unknown";entry:Entry}|{state:"readback";entry:Entry;receipt:LeadReceipt}|{state:"blocked"};
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function exact(v:Record<string,unknown>,keys:string[]){return Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function id(v:unknown):v is string{return typeof v==="string"&&uuid.test(v);}
function version(v:unknown):v is number{return typeof v==="number"&&Number.isSafeInteger(v)&&v>0;}
function receiptValid(v:unknown,e:Pick<Entry,"target"|"expectedVersion">):v is LeadReceipt{
 return object(v)&&exact(v,["leadId","version"])&&id(v.leadId)&&version(v.version)&&(e.target===null||v.leadId===e.target&&v.version===Number(e.expectedVersion)+1);
}
function valid(v:unknown,scope:string):v is Entry{
 if(!object(v)||!exact(v,["schema","scope","key","kind","target","expectedVersion","receipt"])||v.schema!==1||v.scope!==scope||!id(v.key)||typeof v.kind!=="string"||!kinds.has(v.kind))return false;
 if(v.kind==="create"?v.target!==null||v.expectedVersion!==null:!id(v.target)||!version(v.expectedVersion))return false;
 return v.receipt===null||receiptValid(v.receipt,{target:v.target as string|null,expectedVersion:v.expectedVersion as number|null});
}
function validIntent(v:unknown,scope:string):v is IntentEntry{
 return object(v)&&exact(v,["schema","scope","kind","target","intentId","action","key","expectedVersion"])&&v.schema===1&&v.scope===scope&&v.kind==="intent"&&id(v.target)&&id(v.intentId)&&id(v.key)&&!!parseIntentRecovery({action:v.action,key:v.key,expectedVersion:v.expectedVersion});
}
/** Scope is supplied by an admitted principal/Center adapter; journal itself confers no permission. */
export class LeadRecoveryJournal{
 private readonly slot:string;
 constructor(private readonly storage:StoragePort,private readonly scope:string){
  if(!id(scope))throw new Error("LEAD_RECOVERY_SCOPE_INVALID");
  this.slot="pino.leads.pending.v1";
 }
 inspect():View{
  try{
   const raw=this.storage.getItem(this.slot);
   if(raw===null)return {state:"empty"};
   const value:unknown=JSON.parse(raw);
   if(validIntent(value,this.scope))return {state:"intent_unknown",entry:value};
   if(!valid(value,this.scope))return {state:"blocked"};
   return value.receipt?{state:"readback",entry:value,receipt:value.receipt}:{state:"unknown",entry:value};
  }catch{return {state:"blocked"};}
 }
 /** One slot for Household and child writes. Never persist the close reason. */
 beginIntent(target:IntentTarget,action:IntentAction,expectedVersion:number,key:string):void{
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_NOT_EMPTY");
  const entry:IntentEntry={schema:1,scope:this.scope,kind:"intent",target:target.leadId,intentId:target.intentId,action,key,expectedVersion};
  if(!validIntent(entry,this.scope))throw new Error("LEAD_RECOVERY_ENTRY_INVALID");
  this.storage.setItem(this.slot,JSON.stringify(entry));
  const observed=this.inspect();
  if(observed.state!=="intent_unknown"||JSON.stringify(observed.entry)!==JSON.stringify(entry))throw new Error("LEAD_RECOVERY_WRITE_FAILED");
 }
 completeIntentReadback(entry:IntentEntry,receipt:IntentRecovered,detail:Pick<LeadDetail,"id">):void{
  const current=this.inspect();
  const target={leadId:entry.target,intentId:entry.intentId};
  const valid=parseIntentReceipt(receipt,target,entry.action,entry.expectedVersion,true);
  if(current.state!=="intent_unknown"||JSON.stringify(current.entry)!==JSON.stringify(entry)||!valid||detail.id!==entry.target)throw new Error("LEAD_RECOVERY_READBACK_INVALID");
  this.storage.removeItem(this.slot);
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_CLEAR_FAILED");
 }
 begin(command:LeadCommand,key:string):void{
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_NOT_EMPTY");
  const entry:Entry={schema:1,scope:this.scope,key,kind:command.kind,target:command.kind==="create"?null:command.leadId,expectedVersion:command.kind==="create"?null:command.expectedVersion,receipt:null};
  if(!valid(entry,this.scope))throw new Error("LEAD_RECOVERY_ENTRY_INVALID");
  this.persist(entry);
 }
 acceptReceipt(key:string,receipt:LeadReceipt):void{
  const current=this.inspect();
  if(current.state!=="unknown"||current.entry.key!==key||current.entry.kind==="create")throw new Error("LEAD_RECOVERY_KEY_MISMATCH");
  const sanitized={leadId:receipt.leadId,version:receipt.version};
  if(!receiptValid(sanitized,current.entry))throw new Error("LEAD_RECOVERY_RECEIPT_INVALID");
  this.persist({...current.entry,receipt:sanitized});
 }
 /** Create has no durable target before receipt. Verify original phone in memory before clearing; never store it. */
 completeCreateReadback(key:string,receipt:LeadReceipt,detail:Pick<LeadDetail,"id"|"version"|"phone">,expectedPhone:string):void{
  const current=this.inspect();
  if(current.state!=="unknown"||current.entry.key!==key||current.entry.kind!=="create"||!receiptValid({leadId:receipt.leadId,version:receipt.version},current.entry)||detail.id!==receipt.leadId||!version(detail.version)||detail.version<receipt.version||!/^0\d{9}$/.test(expectedPhone)||detail.phone!==expectedPhone)throw new Error("LEAD_RECOVERY_READBACK_INVALID");
  this.storage.removeItem(this.slot);
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_CLEAR_FAILED");
 }
 completeReadback(key:string,detail:Pick<LeadDetail,"id"|"version">):void{
  const current=this.inspect();
  if(current.state!=="readback"||current.entry.kind==="create"||current.entry.key!==key||detail.id!==current.receipt.leadId||!version(detail.version)||detail.version<current.receipt.version)throw new Error("LEAD_RECOVERY_READBACK_INVALID");
  this.storage.removeItem(this.slot);
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_CLEAR_FAILED");
 }
 /** Only a committed lookup on the original opaque tuple plus authorized readback can clear unknown. */
 completeRecoveredReadback(input:LeadRecoveryInput,receipt:LeadRecoveryReceipt,detail:Pick<LeadDetail,"id"|"version">):void{
  const current=this.inspect();
  const validInput=parseLeadRecoveryInput(input);
  if(!validInput||current.state!=="unknown"||current.entry.key!==validInput.key||current.entry.kind!==validInput.kind||current.entry.target!==validInput.target||current.entry.expectedVersion!==validInput.expectedVersion)throw new Error("LEAD_RECOVERY_KEY_MISMATCH");
  const committed=parseLeadRecoveryReceipt(receipt,validInput);
  if(!committed||detail.id!==committed.leadId||!version(detail.version)||detail.version<committed.version)throw new Error("LEAD_RECOVERY_READBACK_INVALID");
  this.storage.removeItem(this.slot);
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_CLEAR_FAILED");
 }
 /** Only call for an authoritative initial rejection before any uncertain delivery. */
 rejectInitial(key:string):void{
  const current=this.inspect();
  if(current.state!=="unknown"||current.entry.key!==key)throw new Error("LEAD_RECOVERY_KEY_MISMATCH");
  this.storage.removeItem(this.slot);
  if(this.inspect().state!=="empty")throw new Error("LEAD_RECOVERY_CLEAR_FAILED");
 }
 private persist(entry:Entry){
  this.storage.setItem(this.slot,JSON.stringify(entry));
  const observed=this.inspect();
  if((observed.state!=="unknown"&&observed.state!=="readback")||JSON.stringify(observed.entry)!==JSON.stringify(entry))throw new Error("LEAD_RECOVERY_WRITE_FAILED");
 }
}
