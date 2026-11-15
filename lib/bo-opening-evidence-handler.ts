import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
export interface BoOpeningEvidenceEnv extends TeamAccessEnv{PINO_BO_CORE:BoAccessCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
const invalid=(status=400)=>Response.json({error:{code:"INVALID_OPENING_EVIDENCE_REQUEST"}},{status,headers});
export async function handleBoOpeningEvidence(request:Request,env:BoOpeningEvidenceEnv,parts:string[],
 keyResolver?:Parameters<typeof teamCredential>[3]):Promise<Response>{
 const list=parts.length===0&&request.method==="GET";
 const subject=(parts[0]==="CLASS"||parts[0]==="RECEPTION")&&uuid.test(parts[1]??"");
 const detail=subject&&parts.length===2&&request.method==="GET";
 const review=subject&&parts.length===3&&parts[2]==="review"&&request.method==="POST";
 const photo=subject&&parts.length===4&&parts[2]==="photo"&&uuid.test(parts[3]??"")&&request.method==="GET";
 if(!list&&!detail&&!review&&!photo)return invalid(404);
 const query=new URL(request.url).searchParams;
 const allowed=list?["centerId","status","subjectType","search","offset","limit","startDate","endDate"]:review?[]:["centerId"];
 for(const k of query.keys())if(!allowed.includes(k)||query.getAll(k).length!==1)return invalid();
 let centerId=query.get("centerId"),body:Record<string,unknown>|undefined;
 if(review){
   const raw=await request.text();if(raw.length>8192)return invalid();
   let input:unknown;try{input=JSON.parse(raw);}catch{return invalid();}
   if(!input||typeof input!=="object"||Array.isArray(input))return invalid();
   const b=input as Record<string,unknown>;
   if(Object.keys(b).some(k=>!["centerId","expectedVersion","roundId","verdict","reason","requestKey"].includes(k)))return invalid();
   centerId=typeof b.centerId==="string"?b.centerId:null;
   const {centerId:_,...rest}=b;body=rest;
 }
 if(!centerId||!uuid.test(centerId))return invalid();
 query.delete("centerId");
 const suffix=query.size?"?"+query.toString():"";
 const outbound:BoAccessRequest={method:request.method,path:["opening-evidence",...parts].join("/")+suffix,resource:{centerId},...(body?{body}:{})};
 try{
   const credential=await teamCredential(request,env,"BO",keyResolver);
   const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
   const responseHeaders={...headers,"x-request-id":result.requestId};
   if(!photo||result.status!==200)return Response.json(result.body,{status:result.status,headers:responseHeaders});
   const payload=result.body as {data?:{mimeType?:unknown;base64?:unknown}};
   const data=payload?.data;
   if(!data||typeof data.mimeType!=="string"||!["image/jpeg","image/png","image/webp"].includes(data.mimeType)||
      typeof data.base64!=="string"||data.base64.length>2796204)return invalid(502);
   let decoded:string;try{decoded=atob(data.base64);}catch{return invalid(502);}
   if(!decoded.length||decoded.length>2*1024*1024)return invalid(502);
   const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
   return new Response(bytes,{status:200,headers:{...responseHeaders,"content-type":data.mimeType}});
 }catch(error){
   if(error instanceof TeamAuthError)return invalid(error.status);
   return Response.json({error:{code:"OPENING_EVIDENCE_UNAVAILABLE"}},{status:503,headers});
 }
}
