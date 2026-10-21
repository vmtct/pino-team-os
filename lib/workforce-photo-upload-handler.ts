import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {callWorkforceCoreWithCredential,workforceTransportContextFromRequest,
  type WorkforceCoreBinding} from "./workforce-core";

export type WorkforcePhotoUploadEnv=TeamAccessEnv&{PINO_WORKFORCE_CORE:WorkforceCoreBinding};
const MAX_BYTES=350*1024;
export async function handleWorkforcePhotoUpload(request:Request,env:WorkforcePhotoUploadEnv):Promise<Response>{
  try{
    if(request.method!=="POST")return Response.json({error:{code:"METHOD_NOT_ALLOWED"}},{status:405});
    const mime=request.headers.get("content-type")?.split(";")[0]?.toLowerCase();
    if(mime!=="image/jpeg"&&mime!=="image/webp")return invalid("Only JPEG/WebP camera captures are allowed");
    const url=new URL(request.url);
    const centerId=url.searchParams.get("centerId"),assignmentId=url.searchParams.get("assignmentId");
    const clientUploadKey=url.searchParams.get("clientUploadKey");
    if(!centerId||!assignmentId||!clientUploadKey||!/^[A-Za-z0-9_-]{16,128}$/.test(clientUploadKey))
      return invalid("Missing photo upload context");
    const length=Number(request.headers.get("content-length")??0);
    if(length>MAX_BYTES)return invalid("Image exceeds 350 KB");
    const bytes=await request.arrayBuffer();
    if(bytes.byteLength<128||bytes.byteLength>MAX_BYTES)return invalid("Invalid camera image size");
    const credential=await teamCredential(request,env,"TOS");
    const core=await callWorkforceCoreWithCredential(env.PINO_WORKFORCE_CORE,{
      method:"POST",path:"/timekeeping/photo/upload",body:{centerId,assignmentId,clientUploadKey,mimeType:mime,bytes},
    },credential,workforceTransportContextFromRequest(request));
    return Response.json(core.body,{status:core.status,headers:{"cache-control":"no-store","x-request-id":core.requestId}});
  }catch(error){
    if(error instanceof TeamAuthError)return Response.json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},{status:error.status});
    console.error("Workforce photo upload failed",error instanceof Error?error.message:"unknown");
    return Response.json({error:{code:"PHOTO_UPLOAD_UNAVAILABLE",message:"Không thể tải ảnh Check-in."}},{status:503});
  }
}
function invalid(message:string){return Response.json({error:{code:"PHOTO_INVALID_INPUT",message}},{status:400,headers:{"cache-control":"no-store"}});}
