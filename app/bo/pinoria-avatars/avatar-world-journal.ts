/** PAP-2153 / PNR-WORLD: host-owned in-memory uncertainty fence, never an authority grant. */
import type {PendingWorldOperation} from "./avatar-world-operation";
import {parseWorldReceipt,type Scope,type WorldReceipt} from "./avatar-world-contract";
export function createWorldOperationJournal(){
 const entries=new Map<string,PendingWorldOperation>();
 const receipts=new Map<PendingWorldOperation,WorldReceipt>();
 return {
  pending:(scope:Scope)=>entries.get(scope.selfId)??null,
  begin:(operation:PendingWorldOperation)=>{
   if(entries.has(operation.scope.selfId))return false;
   entries.set(operation.scope.selfId,operation);return true;
  },
  recordReceipt:(operation:PendingWorldOperation,raw:unknown)=>{
   if(entries.get(operation.scope.selfId)!==operation)return false;
   const receipt=parseWorldReceipt(operation.command,raw);
   const existing=receipts.get(operation);
   if(existing&&(existing.instanceId!==receipt.instanceId||existing.version!==receipt.version))return false;
   receipts.set(operation,receipt);return true;
  },
  receipt:(operation:PendingWorldOperation)=>entries.get(operation.scope.selfId)===operation?receipts.get(operation)??null:null,
  complete:(operation:PendingWorldOperation)=>{
   if(entries.get(operation.scope.selfId)!==operation)return false;
   entries.delete(operation.scope.selfId);receipts.delete(operation);return true;
  },
 };
}
export type WorldOperationJournal=ReturnType<typeof createWorldOperationJournal>;
