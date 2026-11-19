/** PAP-2134 / PAP-2172: scoped in-memory Media transaction and preview lifecycle. */
import {CoreDraftRequestError} from "./core-draft-client";
import {privatePostMediaClient,POST_IMAGE_MAX} from "./private-media-client";
type Api=ReturnType<typeof privatePostMediaClient>;
type Listing=Awaited<ReturnType<Api["list"]>>;
type Upload={kind:"upload";file:Blob;postVersion:number;reserveKey:string;confirmKey:string;reserved?:{id:string;version:number;postVersion:number}};
type Remove={kind:"remove";id:string;postVersion:number;attachmentVersion:number;key:string};
type Pending=Upload|Remove;
const knownRejection=(e:unknown)=>e instanceof CoreDraftRequestError&&[400,401,403,404,405,409].includes(e.status);
export function createPrivateMediaController(api:Api,authorize:(write:boolean)=>boolean,key=()=>crypto.randomUUID(),urls:Pick<typeof URL,"createObjectURL"|"revokeObjectURL">=URL){
 let closed=false,busy=false,pending:Pending|null=null,listing:Listing|null=null,preview:{id:string;url:string}|null=null,previewGeneration=0;
 function closePreview(){previewGeneration++;if(preview)urls.revokeObjectURL(preview.url);preview=null;}
 function guard(write:boolean,signal:AbortSignal){signal.throwIfAborted();if(closed||!authorize(write)){closePreview();throw new CoreDraftRequestError(403);}}
 async function refresh(signal:AbortSignal){guard(false,signal);const next=await api.list(signal);guard(false,signal);listing=next;if(preview&&!next.attachments.some(a=>a.id===preview?.id))closePreview();return next;}
 function requireIdle(){if(busy||pending)throw Error("A previous image command needs reconciliation.");}
 async function execute(signal:AbortSignal,retry:boolean){
  guard(true,signal);if(busy||!pending)throw Error("No available image command.");busy=true;closePreview();
  const command=pending;let acknowledged=false,minimum=0;
  try{
   if(command.kind==="upload"){
    if(!command.reserved){
     const r=await api.reserve(command.file,command.postVersion,command.reserveKey,signal);acknowledged=true;guard(true,signal);
     if(r.attachment.state==="REVOKED"){const result=await refresh(signal);guard(true,signal);if(result.postVersion<r.attachment.postVersion)throw Error("Terminal image revision unavailable.");pending=null;return result;}
     if(r.attachment.state==="READY"){minimum=r.attachment.postVersion;}
     else {command.reserved={id:r.attachment.id,version:r.attachment.version,postVersion:r.attachment.postVersion};}
    }
    if(command.reserved){
     let r:Awaited<ReturnType<Api["confirm"]>>;
     try{r=await api.confirm(command.reserved.id,command.file,command.reserved.postVersion,command.reserved.version,command.confirmKey,signal);}
     catch(e){
      if(!(e instanceof CoreDraftRequestError)||e.status!==409)throw e;
      // No new reservation: only replay the original immutable command to read its current lifecycle.
      guard(true,signal);const prior=await api.reserve(command.file,command.postVersion,command.reserveKey,signal);guard(true,signal);
      if(!prior.replayed||prior.attachment.id!==command.reserved.id||prior.attachment.state==="RESERVED")throw e;
      const result=await refresh(signal);guard(true,signal);
      if(result.postVersion<prior.attachment.postVersion)throw Error("Terminal image revision unavailable.");
      pending=null;return result;
     }
     acknowledged=true;guard(true,signal);
     if(r.attachment.state==="REVOKED"){const result=await refresh(signal);guard(true,signal);if(result.postVersion<r.attachment.postVersion)throw Error("Terminal image revision unavailable.");pending=null;return result;}if(r.attachment.state!=="READY")throw Error("Image command no longer active.");
     minimum=r.committedPostVersion;
    }
   }else{
    const r=await api.revoke(command.id,command.postVersion,command.attachmentVersion,command.key,signal);acknowledged=true;guard(true,signal);minimum=r.committedPostVersion;
   }
   const result=await refresh(signal);guard(true,signal);if(result.postVersion<minimum)throw Error("Image revision not verified.");
   pending=null;return result;
  }catch(e){
   // A first explicit rejection before any acknowledged mutation is definitive.
   // After reserve or uncertain transport, retain original command until replay.
   if(!retry&&!acknowledged&&!(command.kind==="upload"&&command.reserved)&&knownRejection(e))pending=null;
   throw e;
  }finally{busy=false;}
 }
 return {
  async list(signal:AbortSignal){if(busy)throw Error("Image command in progress.");return refresh(signal);},
  async upload(file:Blob,signal:AbortSignal){guard(true,signal);requireIdle();if(!listing)throw Error("Load images first.");if(listing.mediaCount>=5||file.size<1||file.size>POST_IMAGE_MAX||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Invalid image selection.");pending={kind:"upload",file,postVersion:listing.postVersion,reserveKey:key(),confirmKey:key()};return execute(signal,false);},
  async remove(id:string,signal:AbortSignal){guard(true,signal);requireIdle();const item=listing?.attachments.find(a=>a.id===id);if(!item||!listing)throw Error("Image not found.");pending={kind:"remove",id,postVersion:listing.postVersion,attachmentVersion:item.version,key:key()};return execute(signal,false);},
  retry(signal:AbortSignal){return execute(signal,true);},
  hasPending(){return pending!==null;},
  async openPreview(id:string,signal:AbortSignal){guard(false,signal);const item=listing?.attachments.find(a=>a.id===id);if(busy||!item)throw Error("Image unavailable.");closePreview();const generation=previewGeneration,blob=await api.preview(item,signal);guard(false,signal);if(generation!==previewGeneration||!listing?.attachments.some(a=>a.id===id))throw Error("Preview superseded.");const url=urls.createObjectURL(blob);preview={id,url};return preview;},
  closePreview,
  dispose(){closed=true;pending=null;listing=null;closePreview();}
 };
}

/** Never synthesize a new parent version on stale caption or other metadata. */
export async function readVerifiedMediaRecord<R extends {id:string;version:number;mediaCount:number}>(listing:Listing,postId:string,detail:(id:string,signal:AbortSignal)=>Promise<R>,signal:AbortSignal):Promise<R>{
 signal.throwIfAborted();const row=await detail(postId,signal);signal.throwIfAborted();
 if(row.id!==postId||row.version<listing.postVersion||(row.version===listing.postVersion&&row.mediaCount!==listing.mediaCount))throw Error("Post media revision not verified.");
 return row;
}
