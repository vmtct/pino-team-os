/**
 * PAP-1496 / PAP-1491 SPEC-UNLOCK — narrow authenticated BO-to-Core facade.
 * The selected Center is a constraint, never a grant or authority assertion.
 */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from './bo-core';
import {teamCredential,TeamAuthError,type TeamAccessEnv} from './team-auth';
import {HO_STAGING_HOSTNAME} from './host-boundary';

export interface BoSubscriptionSpecialtyEnv extends TeamAccessEnv {
 PINO_BO_CORE:BoAccessCoreBinding;
}
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const list=new RegExp('^subscriptions/'+uuid+'/specialties$','i');
const create=new RegExp('^subscriptions/'+uuid+'/specialty-grants$','i');
const complete=new RegExp('^subscriptions/'+uuid+'/specialty-grants/'+uuid+'/completion$','i');
const id=new RegExp('^'+uuid+'$','i');
type Access={centerId:string;body?:Record<string,unknown>;idempotencyKey?:string};
function json(payload:unknown,status=200,requestId?:string):Response {
 return new Response(JSON.stringify(payload),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  ...(requestId?{'x-request-id':requestId}:{})
 }});
}
const err=(status:number,code:string,message:string)=>json({error:{code,message}},status);
export function isBoSubscriptionSpecialtyPath(path:string):boolean {
 return list.test(path)||create.test(path)||complete.test(path);
}
export function validateSubscriptionSpecialtyScope(path:string,request:Request):{centerId:string;isRead:boolean}|null{
 if(!isBoSubscriptionSpecialtyPath(path))return null;
 const query=new URL(request.url).searchParams;
 const ids=query.getAll('centerId');
 if([...query.keys()].length!==1||ids.length!==1||!id.test(ids[0]!))return null;
 return {centerId:ids[0]!,isRead:list.test(path)};
}
function exact(body:unknown,keys:string[]):body is Record<string,unknown>{
 return Boolean(body&&typeof body==='object'&&!Array.isArray(body))&&
 Object.keys(body as Record<string,unknown>).length===keys.length&&
 Object.keys(body as Record<string,unknown>).every(k=>keys.includes(k));
}
async function bodyFor(path:string,request:Request):Promise<Access['body']>{
 if(request.method==='GET')return undefined;
 const payload:unknown=await request.json();
 if(create.test(path)){
  if(!exact(payload,['specialtyId','effectiveFrom','expectedVersion']))throw new RangeError('Invalid Grant payload');
  if(typeof payload.specialtyId!=='string'||!id.test(payload.specialtyId)||
    typeof payload.effectiveFrom!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(payload.effectiveFrom)||
    payload.expectedVersion!==0)throw new RangeError('Invalid Grant payload');
  return payload;
 }
 if(complete.test(path)){
  if(!exact(payload,['completed','expectedVersion']))throw new RangeError('Invalid Completion payload');
  if(typeof payload.completed!=='boolean'||!Number.isSafeInteger(payload.expectedVersion)||
    Number(payload.expectedVersion)<1)throw new RangeError('Invalid Completion payload');
  return payload;
 }
 throw new RangeError('Unsupported write');
}
export async function handleBoSubscriptionSpecialtyRequest(
 request:Request,env:BoSubscriptionSpecialtyEnv,path:string
):Promise<Response>{
 if(!isBoSubscriptionSpecialtyPath(path))return err(404,'PLATFORM_NOT_FOUND','BO operation not found');
 if(new URL(request.url).hostname===HO_STAGING_HOSTNAME)
  return err(404,'PLATFORM_NOT_FOUND','BO operation not found');
 if((list.test(path)&&request.method!=='GET')||(create.test(path)&&request.method!=='POST')||
    (complete.test(path)&&request.method!=='PATCH'))return err(405,'PLATFORM_METHOD_NOT_ALLOWED','Method not allowed');
 const scope=validateSubscriptionSpecialtyScope(path,request);
 if(!scope)return err(400,'PLATFORM_INVALID_INPUT','Exactly one valid selected Center is required');
 const key=request.headers.get('idempotency-key')?.trim();
 if(!scope.isRead&&(!key||key.length<8||key.length>128))
  return err(400,'PLATFORM_INVALID_INPUT','Idempotency-Key is required');
 try{
  const body=await bodyFor(path,request);
  const credential=await teamCredential(request,env,'BO');
  const core:BoAccessRequest={method:request.method,path,resource:{centerId:scope.centerId},
   ...(body?{body}:{}),...(!scope.isRead?{idempotencyKey:key}:{})};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
  return json(result.body,result.status,result.requestId);
 }catch(cause){
  if(cause instanceof TeamAuthError)
   return err(cause.status,'IDENTITY_AUTHENTICATION_FAILED',cause.message);
  if(cause instanceof RangeError||cause instanceof SyntaxError)
   return err(400,'PLATFORM_INVALID_INPUT','Invalid Subscription Specialty request');
  // Unknown failures never expose credentials, implementation traces or user-scoped data.
  return err(503,'SUBSCRIPTION_SPECIALTY_FACADE_UNAVAILABLE','Subscription Specialty temporarily unavailable');
 }
}
