import {authorizeGlobalTerms} from './ho-global-terms-facade';
import {BoShellGateError} from './bo-shell-gate';
import {TeamAuthError} from './team-auth';
import {HO_STAGING_HOSTNAME,normalizeHostname} from './host-boundary';
import type {HoGlobalTermWeeksEnv} from './ho-global-termweeks-read-facade';
import {object,termUuid} from './ho-global-terms-contract';
import {WEEK_API,weekRequest,parseWeekCommand,parseWeekDetail,parseWeekList} from './ho-termweek-contract';
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const error=(code:string,status:number)=>json({error:{code}},status);
/** PAP-1373: exact HO routes, canonical Founder proof and Core actor; no local persistence. */
export async function handleHoTermWeek(request:Request,env:HoGlobalTermWeeksEnv){try{
 const url=new URL(request.url);const suffix=url.pathname.slice(WEEK_API.length),id=suffix.split('/')[1];
 if(env.APP_ENV!=='staging'||url.protocol!=='https:'||url.hostname!==HO_STAGING_HOSTNAME||normalizeHostname(request.headers.get('host')||'')!==HO_STAGING_HOSTNAME||!weekRequest(url.pathname,request.method))return error('PLATFORM_NOT_FOUND',404);
 const params=[...url.searchParams.keys()];if(params.some(k=>k!=='termId'&&k!=='catalog')||id&&params.length||request.method==='POST'&&params.length||url.searchParams.has('termId')&&!termUuid.test(url.searchParams.get('termId')!))return error('PLATFORM_INVALID_INPUT',400);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json'))return error('HO_REQUEST_DENIED',403);
 const key=request.headers.get('idempotency-key');if(request.method==='POST'&&(!key||!(/^[A-Za-z0-9:_-]{8,120}$/).test(key)))return error('PLATFORM_INVALID_INPUT',400);
 const token=await authorizeGlobalTerms(request,env);const core=env.PINO_WORKFORCE_CORE;
 const call=(method:string,path:string,body:unknown={},idempotencyKey?:string)=>core.executePlanningWithStaffPassword({method,path,body,...(idempotencyKey?{idempotencyKey}:{})},token);
 const action=suffix.endsWith('/delete')?'delete':suffix.endsWith('/update')?'update':'create';
 const input=request.method==='POST'?parseWeekCommand(await request.json().catch(()=>null),action):url.searchParams.has('termId')?{termId:url.searchParams.get('termId')}:{};
 if(!input)return error('PLATFORM_INVALID_INPUT',400);
 const result=await call(request.method,'global-weeks/ho'+suffix,input,request.method==='POST'?key!:undefined);
 const desired=request.method==='POST'&&action==='create'?201:200;
 if(result.status!==desired)return result.status>=200&&result.status<300?error('HO_GLOBAL_WEEK_CONFIRMATION_FAILED',502):error(typeof object(object(result.body)?.error)?.code==='string'?String(object(object(result.body)?.error)?.code):'HO_GLOBAL_WEEK_UNAVAILABLE',result.status);
 if(request.method==='GET'){
  const data=id?parseWeekDetail(result.body):parseWeekList(result.body);if(!data||id&&!Array.isArray(data)&&data.id!==id)return error('HO_GLOBAL_WEEK_DATA_INVALID',502);
  if(!id&&url.searchParams.get('catalog')==='1'){const d=object(object(result.body)?.data)!;return json({data:{terms:(d.terms as unknown[]).map(raw=>{const t=object(raw)!;return {id:t.id,name:t.displayName,startDate:t.startDate,endDate:t.endDate};}),weeks:data}},200);}
  return json({data},200);
 }
 const receipt=object(object(result.body)?.data);
 if(action==='delete'){if(receipt?.termWeekId!==id||receipt.deleted!==true)return error('HO_GLOBAL_WEEK_CONFIRMATION_FAILED',502);const read=await call('GET','global-weeks/ho/'+id);if(read.status!==404)return error('HO_GLOBAL_WEEK_READBACK_MISMATCH',502);return json({data:{termWeekId:id,deleted:true}},200);}
 if(!receipt||typeof receipt.id!=='string'||!termUuid.test(receipt.id)||id&&receipt.id!==id||Object.entries(input).some(([k,v])=>k!=='reason'&&k!=='expectedUpdatedAt'&&receipt[k]!==v))return error('HO_GLOBAL_WEEK_CONFIRMATION_FAILED',502);
 const read=await call('GET','global-weeks/ho/'+receipt.id);if(read.status!==200)return error('HO_GLOBAL_WEEK_READBACK_FAILED',502);
 const detail=parseWeekDetail(read.body);if(!detail||detail.id!==receipt.id||detail.updatedAt!==receipt.updatedAt)return error('HO_GLOBAL_WEEK_READBACK_MISMATCH',502);
 return json({data:detail},desired);
 }catch(e){if(e instanceof BoShellGateError||e instanceof TeamAuthError)return error('HO_ACCESS_DENIED',e.status);return error('HO_GLOBAL_WEEK_UNAVAILABLE',503);}}
