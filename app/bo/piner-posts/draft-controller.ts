/** PAP-2134 / PAP-1746 PNR-APP-HUB. Runtime candidate controller, no mounted route.
 * Authorization supplied by a real BO context provider, not created here.
 * Core is final authorization and transaction authority. Never use for LAN fixtures. */
import {coreDraftClient,CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import {draftDigest,type DraftRetryJournal,type DraftRetryReceipt} from "./draft-retry-journal";
export type DraftCapability="piner.post.view"|"piner.post.create"|"piner.post.edit";
export type DraftActorScope={actorId:string;centerId:string;authorize:(permission:DraftCapability)=>boolean};
type Command={kind:"create";studentId:string;caption:string}|{kind:"edit";postId:string;expectedVersion:number;caption:string};
type Pending={command:Command;key:string};
type Client=ReturnType<typeof coreDraftClient>;
export class DraftCommandPending extends Error{constructor(){super("Yêu cầu trước chưa rõ kết quả. Cần thử lại đúng yêu cầu trước.");}}
export function createDraftController(initial:DraftActorScope,current:()=>DraftActorScope|null,fetcher:typeof fetch=fetch,newKey=()=>crypto.randomUUID(),journal?:DraftRetryJournal){
 const {actorId,centerId}=initial;
 if(!actorId)throw Error("Thiếu người thao tác đã xác thực.");
 const api:Client=coreDraftClient(centerId,fetcher);
 const scopeKey=()=>draftDigest(["pino-posts-v1",actorId,centerId]);
 const fingerprint=(c:Command,key:string)=>draftDigest(["post-command-v1",key,c.kind,c.caption,c.kind==="create"?c.studentId:c.postId,c.kind==="edit"?c.expectedVersion:null]);
 let pending:Pending|null=null,active=false,closed=false;
 function guard(permission:DraftCapability,signal:AbortSignal){
  signal.throwIfAborted();const scope=current();
  if(closed||!scope||scope.actorId!==actorId||scope.centerId!==centerId||!scope.authorize("piner.post.view")||!scope.authorize(permission))throw new CoreDraftRequestError(403);
 }
 const cap=(c:Command):DraftCapability=>c.kind==="create"?"piner.post.create":"piner.post.edit";
 function normalized(command:Command):Command{const caption=command.caption.trim();if(caption.length>2000)throw Error("Caption tối đa 2000 ký tự.");return {...command,caption};}
 function equal(a:Command,b:Command){return a.kind===b.kind&&a.caption===b.caption&&(a.kind==="create"&&b.kind==="create"?a.studentId===b.studentId:a.kind==="edit"&&b.kind==="edit"&&a.postId===b.postId&&a.expectedVersion===b.expectedVersion);}
 async function execute(input:Command,signal:AbortSignal):Promise<CoreDraftRow>{
  const c=normalized(input);guard(cap(c),signal);
  if(active)throw new DraftCommandPending();
  active=true;let acknowledged=false,wasPending=false,receipt:DraftRetryReceipt|null=null,scope:string|null=null;
  try{
   if(pending&&!equal(pending.command,c))throw new DraftCommandPending();
   if(journal){
    scope=await scopeKey();guard(cap(c),signal);
    const prior=journal.read(scope);wasPending=prior!==null||pending!==null;
    if(prior){receipt=prior;if(await fingerprint(c,prior.key)!==prior.fingerprint)throw new DraftCommandPending();}
    else{const key=pending?.key??newKey(),candidate={key,fingerprint:await fingerprint(c,key)};guard(cap(c),signal);receipt=journal.reserve(scope,candidate);if(receipt.key!==candidate.key){wasPending=true;if(await fingerprint(c,receipt.key)!==receipt.fingerprint)throw new DraftCommandPending();}}
    guard(cap(c),signal);pending={command:c,key:receipt.key};
   }else{wasPending=pending!==null;if(!pending)pending={command:c,key:newKey()};}
   const request=pending;
   const result=c.kind==="create"?await api.createDraft({studentId:c.studentId,caption:c.caption,idempotencyKey:request.key},signal):await api.editCaption({postId:c.postId,caption:c.caption,expectedVersion:c.expectedVersion,idempotencyKey:request.key},signal);
   acknowledged=true;guard(cap(c),signal);
   const row=await api.detail(result.row.id,signal);guard(cap(c),signal);
   if(row.studentId!==result.row.studentId||row.version<result.committedVersion)throw Error("Không xác minh được phiên bản đã lưu.");
   if(journal&&scope&&receipt)journal.clear(scope,receipt);
   pending=null;return row;
  }catch(e){
   // First-attempt explicit rejection is definitive, but a later rejection cannot
   // prove an earlier uncertain command did not commit. Never drop that key.
   if(!wasPending&&!acknowledged&&e instanceof CoreDraftRequestError&&[400,401,403,404,405,409].includes(e.status)){if(journal&&scope&&receipt)journal.clear(scope,receipt);pending=null;}
   throw e;
  }finally{active=false;}
 }
 return {
  centerId,
  async list(signal:AbortSignal,beforeId?:string){guard("piner.post.view",signal);const page=await api.list(signal,beforeId);guard("piner.post.view",signal);return page;},
  async detail(postId:string,signal:AbortSignal){guard("piner.post.view",signal);const row=await api.detail(postId,signal);guard("piner.post.view",signal);return row;},
  async studentOptions(signal:AbortSignal,beforeId?:string,limit=100){guard("piner.post.create",signal);const result=await api.studentOptions(signal,beforeId,limit);guard("piner.post.create",signal);return result;},
  createDraft(studentId:string,caption:string,signal:AbortSignal){return execute({kind:"create",studentId,caption},signal);},
  editCaption(postId:string,expectedVersion:number,caption:string,signal:AbortSignal){return execute({kind:"edit",postId,expectedVersion,caption},signal);},
  hasUnresolvedCommand(){return pending!==null;},
  async hasRetainedCommand(signal:AbortSignal){guard("piner.post.view",signal);const scope=await scopeKey();guard("piner.post.view",signal);return pending!==null||Boolean(journal?.read(scope));},
  /** Explicit refresh/reconcile by UI is required after a definitive server conflict.
   * Never discard a pending create after an uncertain transport failure. */
  dispose(){closed=true;pending=null;},
 };
}
