/** PAP-2153 / PNR-WORLD: host-owned in-memory uncertainty fence, never an authority grant. */
import type {PendingWorldOperation} from "./avatar-world-operation";
import type {Scope} from "./avatar-world-contract";
export function createWorldOperationJournal(){
 const entries=new Map<string,PendingWorldOperation>();
 return {
  pending:(scope:Scope)=>entries.get(scope.selfId)??null,
  begin:(operation:PendingWorldOperation)=>{
   if(entries.has(operation.scope.selfId))return false;
   entries.set(operation.scope.selfId,operation);return true;
  },
  complete:(operation:PendingWorldOperation)=>{
   if(entries.get(operation.scope.selfId)!==operation)return false;
   entries.delete(operation.scope.selfId);return true;
  },
 };
}
export type WorldOperationJournal=ReturnType<typeof createWorldOperationJournal>;
