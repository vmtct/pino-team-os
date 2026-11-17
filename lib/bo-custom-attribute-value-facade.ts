/** PAP-1671 / PAP-1665: isolated BO Staging facade; ingress mount is separate. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME} from "./host-boundary";

export type BoCustomAttributeValueEnv=TeamAccessEnv & {PINO_BO_CORE:BoAccessCoreBinding};
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$");
const route=new RegExp("^(students|identity/parents)/("+uuid+")/custom-attributes(?:/("+uuid+"))?$");
const response=(body:unknown,status:number,requestId?:string)=>Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
const error=(status:number,code:string)=>response({error:{code}},status);
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);

export function isBoCustomAttributeValuePath(path:string):boolean{return route.test(path);}
export function isBoCustomAttributeValueMethod(path:string,method:string):boolean{
 const m=route.exec(path);return !!m&&(m[3]===undefined?method==="GET":method==="PATCH");
}
export async function handleBoCustomAttributeValueRequest(request:Request,env:BoCustomAttributeValueEnv,path:string):Promise<Response>{
 const url=new URL(request.url);
 if(url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||!isBoCustomAttributeValuePath(path))return error(404,"PLATFORM_NOT_FOUND");
 if(!isBoCustomAttributeValueMethod(path,request.method))return error(405,"PLATFORM_METHOD_NOT_ALLOWED");
 const read=request.method==="GET",params=url.searchParams;
 const allowed=read?["centerId","limit","afterDefinitionId"]:["centerId"];
 const centerId=params.get("centerId");
 if(!centerId||!id.test(centerId)||[...params.keys()].some(k=>!allowed.includes(k)||params.getAll(k).length!==1))return error(400,"PLATFORM_INVALID_INPUT");
 const limit=params.get("limit"),after=params.get("afterDefinitionId");
 if((limit!==null&&(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100))||(after!==null&&!id.test(after)))return error(400,"PLATFORM_INVALID_INPUT");
 let body:Record<string,unknown>|undefined;
 if(!read){
  if(request.headers.get("origin")!==url.origin||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")return error(403,"PLATFORM_FORBIDDEN");
  try{
   const raw:unknown=await request.json();
   if(!object(raw)||Object.keys(raw).sort().join(",")!=="expectedDefinitionRevision,expectedValueRevision,value"||
     !Number.isSafeInteger(raw.expectedDefinitionRevision)||Number(raw.expectedDefinitionRevision)<1||
     !Number.isSafeInteger(raw.expectedValueRevision)||Number(raw.expectedValueRevision)<0||raw.value===null)return error(400,"PLATFORM_INVALID_INPUT");
   body=raw;
  }catch{return error(400,"PLATFORM_INVALID_INPUT");}
 }
 try{
  const credential=await teamCredential(request,env,"BO");
  const page=new URLSearchParams();
  if(limit!==null)page.set("limit",limit);
  if(after!==null)page.set("afterDefinitionId",after);
  const forward:BoAccessRequest={method:request.method,path:path+(page.size?"?"+page.toString():""),resource:{centerId},...(body?{body}:{})};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,forward,credential);
  if(read&&result.status===200&&(!object(result.body)||!object(result.body.data)||result.body.data.scopeCenterId!==centerId))
   return error(502,"CUSTOM_ATTRIBUTE_SCOPE_MISMATCH");
  return response(result.body,result.status,result.requestId);
 }catch(e){
  if(e instanceof TeamAuthError)return error(e.status,"IDENTITY_AUTHENTICATION_FAILED");
  return error(503,"CUSTOM_ATTRIBUTE_FACADE_UNAVAILABLE");
 }
}