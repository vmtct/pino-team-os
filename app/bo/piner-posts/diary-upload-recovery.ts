/** PAP-2386 / PNR-APP-HUB. Compound upload then exact Diary link, no automatic retry. */
import {draftDigest,type DraftRetryJournal,type DraftRetryReceipt} from "./draft-retry-journal";
import type {createPrivateMediaController} from "./private-media-controller";
import type {createNativeDiaryComposer} from "./native-diary-composer";
type Media=Pick<ReturnType<typeof createPrivateMediaController>,"list"|"upload"|"retry"|"hasPending"|"lastUploadReceipt">;
type Diary=Pick<ReturnType<typeof createNativeDiaryComposer>,"load"|"photos"|"photo"|"link"|"pending"|"retry">;
type Snapshot=Awaited<ReturnType<Diary["load"]>>;
type Input={postId:string;diaryId:string;evidenceId:string;version:number;transform:"RAW"|"RETOUCHED";file?:Blob};
type Intent={input:Omit<Input,"file">;marker:DraftRetryReceipt;file:Blob;media:Media;phase:"upload"|"link";receipt?:NonNullable<ReturnType<Media["lastUploadReceipt"]>>};
export function createDiaryUploadRecovery(deps:{actorId:string;centerId:string;authorize:()=>boolean;journal:DraftRetryJournal;media:(postId:string)=>Media;diary:Diary;newKey?:()=>string}){
 let intent:Intent|null=null,active=false,closed=false;
 const guard=(s:AbortSignal)=>{s.throwIfAborted();if(closed||!deps.authorize())throw Error("Không có quyền thêm ảnh Diary.");};
 const scope=()=>draftDigest(["pino-diary-upload-v1",deps.actorId,deps.centerId]);
 const exact=(a:DraftRetryReceipt|null,b:DraftRetryReceipt)=>a?.key===b.key&&a.fingerprint===b.fingerprint;
 async function complete(i:Intent,key:string,s:AbortSignal):Promise<Snapshot>{
  guard(s);if(!exact(deps.journal.read(key),i.marker))throw Error("Không xác minh được yêu cầu gốc.");
  if(i.phase==="upload"){
   if(i.media.hasPending())await i.media.retry(s);
   guard(s);
   const r=i.media.lastUploadReceipt(),list=await i.media.list(s);guard(s);
   if(!r||r.postVersion!==i.input.version+2||list.postVersion!==r.postVersion||!list.attachments.some(a=>a.id===r.attachmentId&&a.version===r.attachmentVersion&&a.state==="READY"))throw Error("Không xác minh được ảnh đã tải. Không tải lại.");
   i.receipt=r;i.phase="link";
  }
  const r=i.receipt!,p=i.input;
  const matches=(value:Snapshot)=>value.state.provenance.some(x=>x.attachmentId===r.attachmentId&&x.attachmentVersion===r.attachmentVersion&&x.diaryId===p.diaryId&&x.evidenceId===p.evidenceId&&x.transform===p.transform);
  let value=await deps.diary.load(p.postId,s);guard(s);
  const pending=await deps.diary.pending(s);guard(s);
  if(pending.pending){
   if(pending.retryPostId!==p.postId)throw Error("Không xác minh được yêu cầu liên kết.");
   value=await deps.diary.retry(p.postId,s);
  }else if(!matches(value)){
   if(value.state.status!=="DRAFT"||value.state.version!==r.postVersion)throw Error("Post đã thay đổi. Không liên kết lại.");
   value=await deps.diary.link(p.postId,p.diaryId,p.evidenceId,r.attachmentId,p.transform,r.postVersion,s);
  }
  guard(s);
  if(!matches(value)||value.state.version!==r.postVersion+1)throw Error("Không xác minh được nguồn ảnh.");
  if(!exact(deps.journal.read(key),i.marker))throw Error("Không xác minh được yêu cầu gốc.");
  deps.journal.clear(key,i.marker);if(deps.journal.read(key)!==null)throw Error("Không thể kết thúc yêu cầu.");
  intent=null;return value;
 }
 return {
  async pending(s:AbortSignal){guard(s);const key=await scope();guard(s);const marker=deps.journal.read(key);return {pending:marker!==null,retryPostId:marker&&intent&&exact(marker,intent.marker)?intent.input.postId:null};},
  async start(input:Input,s:AbortSignal){
   guard(s);if(active||intent)throw Error("Cần xác minh yêu cầu trước.");active=true;
   try{
    const key=await scope();guard(s);if(deps.journal.read(key)|| (await deps.diary.pending(s)).pending)throw Error("Cần xác minh yêu cầu trước.");
    const {postId,diaryId,evidenceId,version,transform}=input;
    if(transform!=="RAW"&&transform!=="RETOUCHED")throw Error("Nguồn ảnh không hợp lệ.");
    const value=await deps.diary.load(postId,s),photos=await deps.diary.photos(postId,diaryId,version,s),media=deps.media(postId),list=await media.list(s);guard(s);
    if(value.state.status!=="DRAFT"||value.state.version!==version||!value.state.diaryIds.includes(diaryId)||photos.version!==version||photos.claimState!=="SELECTED"||!photos.photos.some(p=>p.id===evidenceId)||list.postVersion!==version||list.mediaCount>=5||media.hasPending())throw Error("Post hoặc Diary đã thay đổi.");
    const file=transform==="RAW"?await deps.diary.photo(postId,diaryId,evidenceId,version,s):input.file;
    if(!file||file.size<1||file.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Ảnh không hợp lệ.");
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
    const marker={key:(deps.newKey??(()=>crypto.randomUUID()))(),fingerprint:await draftDigest(["pino-diary-upload-command-v1",postId,diaryId,evidenceId,version,transform,hash])};guard(s);
    if(!exact(deps.journal.reserve(key,marker),marker))throw Error("Cần xác minh yêu cầu trước.");
    intent={input:{postId,diaryId,evidenceId,version,transform},marker,file,media,phase:"upload"};
    await media.upload(file,s);
    return await complete(intent,key,s);
   }finally{active=false;}
  },
  async retry(postId:string,s:AbortSignal){
   guard(s);if(active||!intent||intent.input.postId!==postId)throw Error("Không có yêu cầu gốc. Không tải lại.");
   active=true;try{const key=await scope();return await complete(intent,key,s);}finally{active=false;}
  },
  dispose(){closed=true;intent=null;}
 };
}
