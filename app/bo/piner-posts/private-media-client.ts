/** PAP-2134 / PAP-2172: selected-Center private Post media client. Requires guarded native session fetch. */
import {CoreDraftRequestError} from "./core-draft-client";
export const POST_IMAGE_MAX=5*1024*1024;
const mimeTypes=["image/jpeg","image/png","image/webp"] as const;
type Mime=typeof mimeTypes[number];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function bad():never{throw new Error("Phản hồi hoặc yêu cầu ảnh Post không hợp lệ.");}
function id(v:unknown):string{if(typeof v!=="string"||!uuid.test(v))bad();return v;}
function integer(v:unknown,min=1,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)bad();return v;}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))bad();return v as Record<string,unknown>;}
function mime(v:unknown):Mime{if(typeof v!=="string"||!mimeTypes.includes(v as Mime))bad();return v as Mime;}
function retryKey(v:string){if(!/^[A-Za-z0-9_-]{16,128}$/.test(v))bad();return v;}
function item(raw:unknown){
 const r=obj(raw),state=r.state;if(state!=="RESERVED"&&state!=="READY"&&state!=="REVOKED")bad();
 if(typeof r.expiresAt!=="string"||!Number.isFinite(Date.parse(r.expiresAt)))bad();
 return {id:id(r.id),state,mimeType:mime(r.mimeType),byteSize:integer(r.byteSize,1,POST_IMAGE_MAX),version:integer(r.version),postVersion:integer(r.postVersion,2),expiresAt:r.expiresAt};
}
type MediaItem=ReturnType<typeof item>;
function receipt(raw:unknown,expectedPostVersion:number,expectedAttachmentId?:string,expectedAttachmentVersion?:number){
 const r=obj(raw),attachment=item(r.attachment),postVersion=integer(r.committedPostVersion),attachmentVersion=integer(r.committedAttachmentVersion);
 if(typeof r.replayed!=="boolean"||postVersion!==expectedPostVersion+1||attachmentVersion!==(expectedAttachmentVersion===undefined?1:expectedAttachmentVersion+1)||attachment.postVersion<postVersion||attachment.version<attachmentVersion||(!r.replayed&&(attachment.postVersion!==postVersion||attachment.version!==attachmentVersion))||(expectedAttachmentId&&attachment.id!==expectedAttachmentId))bad();
 return {attachment,committedPostVersion:postVersion,committedAttachmentVersion:attachmentVersion,replayed:r.replayed};
}
export function privatePostMediaClient(centerId:string,postId:string,fetcher:typeof fetch){
 const root="/api/bo/learning/piner-posts/"+id(postId)+"/attachments",query="?centerId="+id(centerId);
 async function request(path:string,signal:AbortSignal,init:RequestInit={}){
  signal.throwIfAborted();const response=await fetcher(root+path+query,{...init,signal,credentials:"same-origin",cache:"no-store",redirect:"error"});
  signal.throwIfAborted();if(!response.ok)throw new CoreDraftRequestError(response.status);return response;
 }
 async function data(response:Response,signal:AbortSignal){const value=obj(await response.json()).data;signal.throwIfAborted();return value;}
 function imageHeaders(file:Blob,version:number,key:string,attachmentVersion?:number){
  integer(file.size,1,POST_IMAGE_MAX);const headers=new Headers({"content-type":mime(file.type),"idempotency-key":retryKey(key),"x-pino-post-version":String(integer(version))});
  if(attachmentVersion!==undefined)headers.set("x-pino-attachment-version",String(integer(attachmentVersion)));return headers;
 }
 return {
  async list(signal:AbortSignal){
   const r=obj(await data(await request("",signal),signal)),postVersion=integer(r.postVersion),mediaCount=integer(r.mediaCount,0,5);
   if(!Array.isArray(r.attachments)||r.attachments.length!==mediaCount)bad();
   const attachments:MediaItem[]=r.attachments.map(item);
   if(attachments.some(a=>a.state!=="READY"||a.postVersion>postVersion)||new Set(attachments.map(a=>a.id)).size!==attachments.length)bad();
   return {attachments,mediaCount,postVersion};
  },
  async reserve(file:Blob,expectedPostVersion:number,key:string,signal:AbortSignal){
   const r=receipt(await data(await request("",signal,{method:"POST",headers:imageHeaders(file,expectedPostVersion,key),body:file}),signal),expectedPostVersion);
   if(!r.replayed&&r.attachment.state!=="RESERVED")bad();return r;
  },
  async confirm(attachmentId:string,file:Blob,expectedPostVersion:number,expectedAttachmentVersion:number,key:string,signal:AbortSignal){
   const r=receipt(await data(await request("/"+id(attachmentId)+"/confirm",signal,{method:"POST",headers:imageHeaders(file,expectedPostVersion,key,expectedAttachmentVersion),body:file}),signal),expectedPostVersion,attachmentId,expectedAttachmentVersion);
   if(!r.replayed&&r.attachment.state!=="READY")bad();return r;
  },
  async revoke(attachmentId:string,expectedPostVersion:number,expectedAttachmentVersion:number,key:string,signal:AbortSignal){
   const r=receipt(await data(await request("/"+id(attachmentId)+"/revoke",signal,{method:"POST",headers:{"content-type":"application/json","idempotency-key":retryKey(key)},body:JSON.stringify({expectedPostVersion:integer(expectedPostVersion),expectedAttachmentVersion:integer(expectedAttachmentVersion)})}),signal),expectedPostVersion,attachmentId,expectedAttachmentVersion);
   if(r.attachment.state!=="REVOKED")bad();return r;
  },
  async preview(attachmentId:string,signal:AbortSignal){
   const response=await request("/"+id(attachmentId)+"/preview",signal),type=mime(response.headers.get("content-type")),length=response.headers.get("content-length");
   if(length===null||!/^\d+$/.test(length))bad();const size=integer(Number(length),1,POST_IMAGE_MAX);
   const reader=response.body?.getReader();if(!reader)bad();const chunks:Uint8Array<ArrayBuffer>[]=[];let total=0;
   try{while(true){signal.throwIfAborted();const next=await reader.read();if(next.done)break;total+=next.value.byteLength;if(total>size){await reader.cancel();bad();}chunks.push(Uint8Array.from(next.value));}signal.throwIfAborted();if(total!==size)bad();return new Blob(chunks,{type});}finally{reader.releaseLock();}
  }
 };
}
