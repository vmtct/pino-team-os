/** PAP-2153 / PNR-WORLD: scope-bound coordinator; transport injected by the host. */
import {loadAvatarWorld,mutateAvatarWorld,AvatarWorldApiError} from "./avatar-world-api";
import {beginWorldOperation,type PendingWorldOperation} from "./avatar-world-operation";
import {createWorldOperationJournal,type WorldOperationJournal} from "./avatar-world-journal";
import type {Scope,AvatarWorldState,WorldIntent} from "./avatar-world-contract";
export type WorldTabSnapshot={
 status:"loading"|"ready"|"denied"|"error"; state:AvatarWorldState|null;
 busy:boolean; instanceId:string|null; pending:PendingWorldOperation|null; blocked:boolean; message:string;
};
export function createWorldTabController(scope:Scope,grants:ReadonlySet<string>,fetcher:typeof fetch,keyFactory:()=>string,publish:(snapshot:WorldTabSnapshot)=>void,journal:WorldOperationJournal=createWorldOperationJournal()){
 const bound=Object.freeze({...scope}),permissions=new Set(grants);
 const canRead=["pinoria.avatar.directory.view","pinoria.self.loadout.view","pinoria.world.avatar.view"].every(k=>permissions.has(k));
 const abort=new AbortController();
 let disposed=false,inFlight=false;
 const pendingHere=()=>{const p=journal.pending(bound);return canRead&&p&&p.scope.centerId===bound.centerId&&p.scope.studentProfileId===bound.studentProfileId?p:null};
 let current:WorldTabSnapshot={status:canRead?"loading":"denied",state:null,busy:false,instanceId:null,pending:pendingHere(),blocked:!!journal.pending(bound),message:""};
 const emit=(patch:Partial<WorldTabSnapshot>)=>{if(disposed)return;current={...current,...patch,pending:pendingHere(),blocked:!!journal.pending(bound)};publish(current)};
 const failure=(e:unknown)=>e instanceof AvatarWorldApiError&&(e.status===401||e.status===403)?"denied" as const:"error" as const;
 async function reload(){
  if(disposed||inFlight||!canRead)return;
  inFlight=true;emit({status:"loading",state:null,busy:true,message:current.pending?current.message:""});
  try{
   const state=await loadAvatarWorld(bound,fetcher,abort.signal);
   if(disposed)return;
   emit({status:"ready",state,instanceId:state.instances.some(i=>i.id===current.instanceId)?current.instanceId:null,
    message:journal.pending(bound)?"Kết quả thao tác trước chưa được xác nhận. Không gửi lại thao tác.":""});
  }catch(e){emit({status:failure(e),state:null,message:"Không tải được World."})}
  finally{inFlight=false;emit({busy:false})}
 }
 async function confirm(intent:WorldIntent){
  if(disposed||inFlight||!canRead||current.status!=="ready"||!current.state)return; if(journal.pending(bound)){emit({message:"Kết quả thao tác trước chưa được xác nhận."});return}
  const previous=current.state;
  let pending:PendingWorldOperation;
  try{pending=beginWorldOperation(previous,intent,permissions,keyFactory())}catch{emit({message:"Thao tác không còn khả dụng."});return}
  if(!journal.begin(pending)){emit({message:"Đang có thao tác chưa xác nhận."});return} inFlight=true;emit({busy:true,message:""});
  try{
   const result=await mutateAvatarWorld(previous,pending.intent,permissions,pending.key,fetcher,abort.signal);
   journal.complete(pending);emit({state:result.state,status:"ready",message:"Đã xác nhận thao tác World."});
  }catch(e){
   // Even a failed readback after a successful POST is uncertain. Never replay automatically.
   emit({state:null,status:failure(e),message:"Chưa xác nhận kết quả thao tác. Hãy tải lại để kiểm tra; không gửi lại."});
  }finally{inFlight=false;emit({busy:false})}
 }
 return {snapshot:()=>current,reload,confirm,
  open:(id:string)=>{if(!disposed&&!inFlight&&current.status==="ready"&&current.state?.instances.some(i=>i.id===id))emit({instanceId:id})},
  back:()=>{if(!inFlight)emit({instanceId:null})},
  dispose:()=>{disposed=true;abort.abort()}
 };
}
