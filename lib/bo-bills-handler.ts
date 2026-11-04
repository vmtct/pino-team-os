// PAP-1421: selected Center is a constraint; Core remains permission authority.
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {billUuid} from "./bo-bills-api";
type Env=TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
import {billMethodAllowed} from "./bo-bills-paths";
export {isBoBillsPath,billMethodAllowed} from "./bo-bills-paths";
const root="billing/bill-drafts";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const item=new RegExp(`^${root}/(${uuid})(?:/(issue-preview|issue|items)(?:/(${uuid}))?)?$`,"i");
const list=new RegExp(`^${root}/center/(${uuid})$`,"i");
const json=(body:unknown,status:number,requestId?:string)=>Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
const error=(status:number,message:string)=>json({error:{message}},status);
export async function handleBoBillsRequest(request:Request,env:Env,path:string):Promise<Response>{
 try{
  // This slice is staging-only; HO/TOS cannot use the new BO facade.
  if(new URL(request.url).hostname!=="bo.staging.pinohouse.art")return error(404,"Not found");
  if(!billMethodAllowed(path,request.method))return error(405,"Method not allowed");
  const params=new URL(request.url).searchParams,center=params.get("centerId")??"";
  if([...params.keys()].length!==1||params.getAll("centerId").length!==1||!billUuid.test(center))return error(400,"Exactly one Center is required");
  const credential=await teamCredential(request,env,"BO");
  const call=(v:BoAccessRequest)=>callBoAccessCoreWithCredential(env.PINO_BO_CORE,v,credential);
  const match=item.exec(path),listed=list.exec(path);
  if(listed&&listed[1]!==center)return error(403,"Wrong Center");
  let body:Record<string,unknown>|undefined;
  if(request.method!=="GET"){
   try{body=await request.json();}catch{return error(400,"JSON body required");}
   if(!body||typeof body!=="object"||Array.isArray(body))return error(400,"Object required");
   const allowed=path===root?["centerId","payerParentUserId","billDiscountMinor","dueOn","note"]:
    match?.[2]==="issue"||request.method==="DELETE"?["expectedVersion"]:
    match?.[2]==="items"?["expectedVersion","unitPriceMinor","discountAmountMinor","descriptionSnapshot",...(request.method==="POST"?["subscriptionId"]:[])]:["expectedVersion","billDiscountMinor","dueOn","note"];
   if(Object.keys(body).some(k=>!allowed.includes(k)))return error(400,"Unexpected Bill field");
   if(path===root&&body.centerId!==center)return error(403,"Wrong Center");
  }
  const key=request.headers.get("idempotency-key")?.trim();
  if(request.method==="POST"&&(!key||key.length>200))return error(400,"Idempotency-Key required");
  if(match){
   const owner=await call({method:"GET",path:root+"/"+match[1]});
   if(owner.status!==200)return json(owner.body,owner.status,owner.requestId);
   const data=(owner.body as {data?:{centerId?:string}})?.data;
   if(data?.centerId!==center)return error(403,"Wrong Center");
   if(path===root+"/"+match[1]&&request.method==="GET")return json(owner.body,owner.status,owner.requestId);
  }
  const result=await call({method:request.method,path,...(body?{body}:{}),...(key?{idempotencyKey:key}:{})});
  return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return error(e.status,e.message);return error(500,"Bill service unavailable");}
}
