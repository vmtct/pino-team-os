import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding} from "./bo-core";
export type BoPhotoEvidenceEnv=TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
const id="[0-9a-f-]{36}";
const image=new RegExp("^workforce/timekeeping/photos/("+id+")$");
const grid=new RegExp("^workforce/payroll/periods/("+id+")/staff/("+id+")/checkin-photos$");
export function isBoPhotoEvidencePath(path:string){return image.test(path)||grid.test(path);}
export async function handleBoPhotoEvidence(request:Request,env:BoPhotoEvidenceEnv,path:string):Promise<Response>{
 try{
  if(request.method!=="GET")return Response.json({error:{code:"METHOD_NOT_ALLOWED"}},{status:405});
  if(!isBoPhotoEvidencePath(path))return Response.json({error:{code:"NOT_FOUND"}},{status:404});
  const url=new URL(request.url),centerId=url.searchParams.get("centerId")?.trim();
  if(!centerId)return Response.json({error:{code:"PHOTO_CENTER_REQUIRED"}},{status:400});
  const offset=url.searchParams.get("offset")??"0";
  const cred=await teamCredential(request,env,"BO");
  const core=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,
    {method:"GET",path,body:{centerId,offset},resource:{centerId}},cred);
  const hdr={"cache-control":"private, no-store","x-request-id":core.requestId};
  if(core.status<200||core.status>=300)return Response.json(core.body,{status:core.status,headers:hdr});
  if(grid.test(path))return Response.json(core.body,{status:200,headers:hdr});
  const data=(core.body as {data?:{bytes?:unknown;byteSize?:unknown;mimeType?:unknown}}).data;
  if(!data||(data.mimeType!=="image/jpeg"&&data.mimeType!=="image/webp")||
    !(data.bytes instanceof ArrayBuffer)||data.bytes.byteLength!==data.byteSize||data.bytes.byteLength>350*1024)
    return Response.json({error:{code:"PHOTO_PRIVATE_OBJECT_INVALID"}},{status:502,headers:hdr});
  return new Response(data.bytes,{status:200,headers:{
    ...hdr,"content-type":data.mimeType,"content-length":String(data.bytes.byteLength),
    "x-content-type-options":"nosniff","content-disposition":"inline",
  }});
 }catch(error){
  if(error instanceof TeamAuthError)return Response.json({error:{code:"IDENTITY_AUTHENTICATION_FAILED"}},{status:error.status});
  console.error("BO photo evidence unavailable",error instanceof Error?error.message:"unknown");
  return Response.json({error:{code:"PHOTO_PRIVATE_READ_UNAVAILABLE"}},{status:503});
 }
}
