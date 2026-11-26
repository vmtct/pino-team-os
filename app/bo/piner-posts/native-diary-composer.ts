/** PAP-2386 / PNR-APP-HUB. Native Diary read/command port, no mock sources or automatic replay. */
import type {CoreDraftRow} from "./core-draft-client";
import type {postWorkflowReadClient} from "./workflow-read-client";
import type {createWorkflowCoordinator} from "./workflow-coordinator";
import type {createPrivateMediaController} from "./private-media-controller";
import type {WorkflowCommand} from "./workflow-client";
type Read=ReturnType<typeof postWorkflowReadClient>;
type State=Awaited<ReturnType<Read["state"]>>;
type Diary=Awaited<ReturnType<Read["discover"]>>["diaries"][number];
type Listing=Awaited<ReturnType<ReturnType<typeof createPrivateMediaController>["list"]>>;
type Command=Exclude<WorkflowCommand,{kind:"submit"}>;
type Workflow=Pick<ReturnType<typeof createWorkflowCoordinator>,"run"|"retry"|"hasPending">;
export function createNativeDiaryComposer(deps:{centerId:string;canCompose:()=>boolean;detail:(id:string,s:AbortSignal)=>Promise<CoreDraftRow>;read:Read;list:(id:string,s:AbortSignal)=>Promise<Listing>;workflow:Workflow;newKey?:()=>string}){
 let active=false,retained:Command|null=null;
 const guard=(s:AbortSignal)=>{s.throwIfAborted();if(!deps.canCompose())throw Error("Bạn chưa có quyền soạn từ Diary.");};
 const key=()=> (deps.newKey??(()=>crypto.randomUUID()))();
 async function load(postId:string,s:AbortSignal){
  guard(s);
  const row=await deps.detail(postId,s);
  if(row.id!==postId||row.centerId!==deps.centerId||row.programKey!=="AFTERSCHOOL")throw Error("Diary không thuộc Post Afterschool.");
  const state=await deps.read.state(postId,s),diaries:Diary[]=[],seen=new Set<string>();
  if(state.version!==row.version||state.status!==(row.status==="Nháp"?"DRAFT":"PENDING_APPROVAL"))throw Error("Post đã thay đổi.");
  let after:string|undefined;
  for(let page=0;page<20;page++){
   guard(s);const next=await deps.read.discover(postId,s,{after,limit:10});
   if(next.version!==state.version||next.diaries.some(d=>seen.has(d.diaryId)))throw Error("Danh sách Diary đã thay đổi.");
   for(const d of next.diaries){seen.add(d.diaryId);diaries.push(d);}
   if(next.nextAfter===null){
    const final=await deps.read.state(postId,s);guard(s);
    if(JSON.stringify(final)!==JSON.stringify(state)||diaries.some(d=>(d.claimState==="SELECTED")!==state.diaryIds.includes(d.diaryId))||state.diaryIds.some(id=>!seen.has(id)))throw Error("Không xác minh được Diary đã chọn.");
    return {state,diaries};
   }
   if(!next.diaries.length||after&&next.nextAfter<=after)throw Error("Phân trang Diary không tiến.");
   after=next.nextAfter;
  }
  throw Error("Danh sách Diary vượt giới hạn đọc.");
 }
 function writable(state:State,v:number){if(state.status!=="DRAFT"||state.version!==v)throw Error("Post đã thay đổi.");}
 async function finish(c:Command,s:AbortSignal,retry:boolean){
  try{const receipt=await (retry?deps.workflow.retry(c,s):deps.workflow.run(c,s));guard(s);if(receipt.committedVersion!==c.expectedVersion+1)throw Error("Phiên bản Diary không hợp lệ.");
   retained=null;return await load(c.postId,s);
  }catch(e){try{if(!await deps.workflow.hasPending(s))retained=null;}catch{/* retain original command */}throw e;}
 }
 async function mutate(s:AbortSignal,fn:()=>Promise<Command>){
  guard(s);if(active)throw Error("Yêu cầu trước chưa hoàn tất.");active=true;
  try{if(await deps.workflow.hasPending(s))throw Error("Cần xác minh yêu cầu trước.");const c=await fn();guard(s);retained=c;return await finish(c,s,false);}finally{active=false;}
 }
 return {load,
  async photos(postId:string,diaryId:string,version:number,s:AbortSignal){guard(s);const data=await deps.read.photos(postId,diaryId,s);guard(s);if(data.version!==version)throw Error("Diary đã thay đổi.");return data;},
  async photo(postId:string,diaryId:string,evidenceId:string,version:number,s:AbortSignal){
   guard(s);const before=await deps.read.photos(postId,diaryId,s);if(before.version!==version||!before.photos.some(p=>p.id===evidenceId))throw Error("Ảnh Diary không còn khả dụng.");
   const data=await deps.read.photo(postId,diaryId,evidenceId,s),after=await deps.read.photos(postId,diaryId,s);guard(s);
   const pin=after.photos.find(p=>p.id===evidenceId);
   if(after.version!==version||after.claimState!==before.claimState||!pin||pin.byteSize!==data.byteSize||pin.mimeType!==data.mimeType||pin.confirmedAt!==data.confirmedAt||JSON.stringify(before.photos)!==JSON.stringify(after.photos))throw Error("Ảnh Diary đã thay đổi.");
   return new Blob([Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))],{type:data.mimeType});
  },
  toggle(postId:string,diaryId:string,version:number,s:AbortSignal){return mutate(s,async()=>{
   const {state,diaries}=await load(postId,s);writable(state,version);const d=diaries.find(d=>d.diaryId===diaryId);
   if(!d||d.claimState==="USED"||state.provenance.some(p=>p.diaryId===diaryId)&&d.claimState==="SELECTED")throw Error("Diary đang được sử dụng.");
   const diaryIds=d.claimState==="SELECTED"?state.diaryIds.filter(id=>id!==diaryId):[...state.diaryIds,diaryId].sort();
   if(diaryIds.length>20)throw Error("Tối đa 20 Diary.");
   return {kind:"diary-selection",postId,expectedVersion:version,diaryIds,idempotencyKey:key()};
  });},
  link(postId:string,diaryId:string,evidenceId:string,attachmentId:string,transform:"RAW"|"RETOUCHED",version:number,s:AbortSignal){return mutate(s,async()=>{
   const {state}=await load(postId,s);writable(state,version);
   if(!state.diaryIds.includes(diaryId)||state.provenance.some(p=>p.attachmentId===attachmentId))throw Error("Nguồn Diary không hợp lệ.");
   const photos=await deps.read.photos(postId,diaryId,s),media=await deps.list(postId,s),a=media.attachments.find(x=>x.id===attachmentId);
   if(photos.version!==version||photos.claimState!=="SELECTED"||!photos.photos.some(p=>p.id===evidenceId)||media.postVersion!==version||!a||a.state!=="READY")throw Error("Ảnh đã thay đổi.");
   return {kind:"diary-provenance",postId,diaryId,evidenceId,attachmentId,transform,expectedVersion:version,expectedAttachmentVersion:a.version,idempotencyKey:key()};
  });},
  async pending(s:AbortSignal){guard(s);const pending=await deps.workflow.hasPending(s);guard(s);return {pending,retryPostId:pending?retained?.postId??null:null};},
  async retry(postId:string,s:AbortSignal){guard(s);if(active||!retained||retained.postId!==postId)throw Error("Không có yêu cầu gốc.");active=true;try{if(!await deps.workflow.hasPending(s))throw Error("Không có yêu cầu chờ.");return await finish(retained,s,true);}finally{active=false;}}
 };
}
