import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
import { callWorkforceCoreWithCredential, workforceTransportContextFromRequest, type WorkforceCoreBinding } from "./workforce-core";

export type WorkforcePhotoUploadEnv = TeamAccessEnv & { PINO_WORKFORCE_CORE: WorkforceCoreBinding };
export const MAX_CAMERA_PHOTO_BYTES = 350 * 1024;
const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badInput(message:string):Response {
 return Response.json({error:{code:"PHOTO_INVALID_INPUT",message}},{status:400,headers:{"cache-control":"no-store"}});
}

/** Byte-bounded binary body; no File/gallery path or persistent browser storage. */
export async function readCameraPhotoBytes(request:Request):Promise<ArrayBuffer> {
 const lengthHeader=request.headers.get("content-length");
 if(lengthHeader!==null && (!/^\d+$/.test(lengthHeader)||Number(lengthHeader)>MAX_CAMERA_PHOTO_BYTES))
  throw new Error("PHOTO_TOO_LARGE");
 const reader=request.body?.getReader();
 if(!reader)throw new Error("PHOTO_EMPTY");
 let length=0;
 const chunks:Uint8Array[]=[];
 try {
  for(;;) {
   const next=await reader.read();if(next.done)break;
   length+=next.value.byteLength;
   if(length>MAX_CAMERA_PHOTO_BYTES)throw new Error("PHOTO_TOO_LARGE");
   chunks.push(next.value);
  }
 } catch(cause) { await reader.cancel().catch(()=>{});throw cause; }
 finally { reader.releaseLock(); }
 if(length<128)throw new Error("PHOTO_EMPTY");
 const result=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}
 return result.buffer;
}

function matchesSignature(bytes:ArrayBuffer,mime:string):boolean {
 const d=new Uint8Array(bytes);
 if(mime==="image/jpeg")return d.length>=4&&d[0]===255&&d[1]===216&&d[2]===255;
 if(mime==="image/webp")return d.length>=12&&String.fromCharCode(...d.slice(0,4))==="RIFF"&&String.fromCharCode(...d.slice(8,12))==="WEBP";
 return false;
}

/** TOS only; Core must authenticate Staff, verify session ownership/center and return BOUND receipt. */
export async function handleWorkforcePhotoUpload(request:Request,env:WorkforcePhotoUploadEnv):Promise<Response> {
 try {
  if(request.method!=="POST")return Response.json({error:{code:"METHOD_NOT_ALLOWED"}},{status:405});
  const mime=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="image/jpeg"&&mime!=="image/webp")return badInput("Only JPEG/WebP camera captures are accepted.");
  const url=new URL(request.url);
  const sessionId=url.searchParams.get("sessionId");
  const clientUploadKey=url.searchParams.get("clientUploadKey");
  if(!sessionId||!uuidPattern.test(sessionId)||!clientUploadKey||!keyPattern.test(clientUploadKey))
   return badInput("Invalid session or photo retry context.");
  let bytes:ArrayBuffer;
  try { bytes=await readCameraPhotoBytes(request); }
  catch {return badInput("Invalid or oversized camera image (max 350 KB).");}
  if(!matchesSignature(bytes,mime))return badInput("Image signature does not match media type.");
  const credential=await teamCredential(request,env,"TOS");
  const response=await callWorkforceCoreWithCredential(env.PINO_WORKFORCE_CORE,{
   method:"POST",path:"/timekeeping/photo/upload",
   body:{sessionId,clientUploadKey,mimeType:mime,bytes},
  },credential,workforceTransportContextFromRequest(request));
  return Response.json(response.body,{status:response.status,headers:{
   "cache-control":"private, no-store","x-content-type-options":"nosniff","x-request-id":response.requestId,
  }});
 } catch(error) {
  if(error instanceof TeamAuthError)return Response.json({
   error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message},
  },{status:error.status,headers:{"cache-control":"no-store"}});
  console.error("Workforce photo evidence upload unavailable",error instanceof Error?error.message:"unknown");
  return Response.json({error:{code:"PHOTO_UPLOAD_UNAVAILABLE",message:"Chưa thể lưu ảnh. Check-in vẫn hợp lệ; hãy thử lại sau."}},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
