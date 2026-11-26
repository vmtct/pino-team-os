/** PAP-2386 / PNR-APP-HUB. Feature-local command fence; not mounted. */
import {draftDigest,type DraftRetryJournal,type DraftRetryReceipt} from "./draft-retry-journal";
import {postWorkflowClient,PostWorkflowError,snapshotWorkflow,type WorkflowCommand} from "./workflow-client";
type Capability="piner.post.view"|"piner.post.submit"|"piner.post.diary.compose";
type Scope={actorId:string;centerId:string;authorize:(permission:Capability)=>boolean};
type Receipt=Awaited<ReturnType<ReturnType<typeof postWorkflowClient>>>;
type Readback=(receipt:Receipt,signal:AbortSignal)=>Promise<boolean>;
export class WorkflowPending extends Error{constructor(){super("Yêu cầu chưa được xác minh. Chỉ thử lại đúng yêu cầu trước.");}}
export function createWorkflowCoordinator(initial:Scope,current:()=>Scope|null,execute:ReturnType<typeof postWorkflowClient>,readback:Readback,journal:DraftRetryJournal){
 const {actorId,centerId}=initial;
 if(!actorId||!centerId)throw Error("Missing workflow scope");
 let active=false,closed=false;
 const permission=(command:WorkflowCommand):Capability=>command.kind==="submit"?"piner.post.submit":"piner.post.diary.compose";
 const guard=(cap:Capability,signal:AbortSignal)=>{
  signal.throwIfAborted();const s=current();
  if(closed||!s||s.actorId!==actorId||s.centerId!==centerId||!s.authorize("piner.post.view")||!s.authorize(cap))throw new PostWorkflowError(403,false);
 };
 const scopeKey=()=>draftDigest(["pino-post-workflow-v1",actorId,centerId]);
 async function run(input:WorkflowCommand,signal:AbortSignal,retry=false){
  const command=snapshotWorkflow(input),cap=permission(command);
  guard(cap,signal);if(active)throw new WorkflowPending();active=true;
  let acknowledged=false,prior:DraftRetryReceipt|null=null,receipt:DraftRetryReceipt|null=null,scope:string|undefined,attempted=false;
  try{
   scope=await scopeKey();guard(cap,signal);prior=journal.read(scope);
   const fingerprint=await draftDigest(["pino-post-workflow-command-v1",command]);
   guard(cap,signal);
   if(prior&&(!retry||prior.key!==command.idempotencyKey||prior.fingerprint!==fingerprint))throw new WorkflowPending();
   if(retry&&!prior)throw new WorkflowPending();
   const candidate={key:command.idempotencyKey,fingerprint};
   receipt=journal.reserve(scope,candidate);
   if(receipt.key!==candidate.key||receipt.fingerprint!==candidate.fingerprint)throw new WorkflowPending();
   guard(cap,signal);attempted=true;
   const result=await execute(command,signal);acknowledged=true;
   guard(cap,signal);
   const confirmed=await readback(result,signal);
   guard(cap,signal);
   if(!confirmed)throw new WorkflowPending();
   journal.clear(scope,receipt);return result;
  }catch(e){
   if(!prior&&scope&&receipt&&!acknowledged&&e instanceof PostWorkflowError&&!e.uncertain&&(!attempted||[400,401,403,404,405,409,422].includes(e.status)))journal.clear(scope,receipt);
   throw e;
  }finally{active=false;}
 }
 return {run:(c:WorkflowCommand,s:AbortSignal)=>run(c,s),retry:(c:WorkflowCommand,s:AbortSignal)=>run(c,s,true),async hasPending(signal:AbortSignal){guard("piner.post.view",signal);const key=await scopeKey();guard("piner.post.view",signal);return journal.read(key)!==null;},dispose(){closed=true;}};
}
