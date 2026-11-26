/** PAP-2386 / PNR-APP-HUB. Native submit review port, no presentation or automatic replay. */
import type {CoreDraftRow} from "./core-draft-client";
import type {createPrivateMediaController} from "./private-media-controller";
import type {WorkflowCommand} from "./workflow-client";
import type {createWorkflowCoordinator} from "./workflow-coordinator";
type Listing=Awaited<ReturnType<ReturnType<typeof createPrivateMediaController>["list"]>>;
type SubmitCommand=Extract<WorkflowCommand,{kind:"submit"}>;
type Workflow=Pick<ReturnType<typeof createWorkflowCoordinator>,"run"|"retry"|"hasPending">;
export function createNativeSubmitReview(deps:{
 centerId:string;canSubmit:()=>boolean;detail:(id:string,signal:AbortSignal)=>Promise<CoreDraftRow>;
 list:(id:string,signal:AbortSignal)=>Promise<Listing>;workflow:Workflow;newKey?:()=>string;
}){
 let active=false,retained:SubmitCommand|null=null;
 const guard=(signal:AbortSignal)=>{signal.throwIfAborted();if(!deps.canSubmit())throw Error("Bạn chưa có quyền gửi duyệt.");};
 async function finish(c:SubmitCommand,signal:AbortSignal,retry:boolean){
  try{
   const receipt=await (retry?deps.workflow.retry(c,signal):deps.workflow.run(c,signal));
   guard(signal);
   if(receipt.committedVersion!==c.expectedVersion+1)throw Error("Phiên bản gửi duyệt không hợp lệ.");
   const row=await deps.detail(c.postId,signal);guard(signal);
   if(row.id!==c.postId||row.centerId!==deps.centerId||row.status!=="Chờ duyệt"||row.version!==receipt.committedVersion)throw Error("Không xác minh được Post đã gửi duyệt.");
   retained=null;return row;
  }catch(e){
   // If the journal is unavailable, keep the original intent rather than permit a new submission.
   try{if(!await deps.workflow.hasPending(signal))retained=null;}catch{/* fail closed */}
   throw e;
  }
 }
 return {
  async pending(signal:AbortSignal){guard(signal);const pending=await deps.workflow.hasPending(signal);guard(signal);return {pending,retryPostId:pending?retained?.postId??null:null};},
  async submit(postId:string,expectedVersion:number,order:readonly string[],signal:AbortSignal){
   guard(signal);if(active)throw Error("Đang gửi duyệt.");active=true;
   try{
    if(await deps.workflow.hasPending(signal))throw Error("Cần xác minh yêu cầu trước.");
    const ids=[...order];if(ids.length<1||ids.length>5||new Set(ids).size!==ids.length)throw Error("Chọn từ 1 đến 5 ảnh.");
    const row=await deps.detail(postId,signal),listing=await deps.list(postId,signal);guard(signal);
    if(row.id!==postId||row.centerId!==deps.centerId||row.status!=="Nháp"||!String(row.caption??"").trim()||row.version!==expectedVersion||listing.postVersion!==expectedVersion||row.mediaCount!==ids.length||listing.mediaCount!==ids.length||listing.attachments.length!==ids.length||listing.attachments.some(a=>a.state!=="READY"||!ids.includes(a.id)))throw Error("Post đã thay đổi. Tải lại trước khi gửi duyệt.");
    const command:SubmitCommand={kind:"submit",postId,expectedVersion,attachmentIds:Object.freeze(ids),idempotencyKey:(deps.newKey??(()=>crypto.randomUUID()))()};
    retained=command;return await finish(command,signal,false);
   }finally{active=false;}
  },
  async retry(postId:string,signal:AbortSignal){
   guard(signal);if(active||!retained||retained.postId!==postId||!await deps.workflow.hasPending(signal))throw Error("Không có yêu cầu gốc để thử lại. Cần xác minh trước.");
   active=true;try{return await finish(retained,signal,true);}finally{active=false;}
  }
 };
}
