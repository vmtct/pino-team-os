// PAP-2365 / PLT-PRODUCT-PLAN: feature-owned authenticated HO facade, not generic mutation.
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callBoAccessCoreWithStaffPassword} from "./bo-core";
import {planRequest,parseCatalogBody,planHost,planActorHeader} from "../app/ho/billing/product-plans/product-plan-http-contract";
import {isPlanId} from "../app/ho/billing/product-plans/product-plan-native-contract";
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const fail=(status:number)=>json({error:{code:"HO_PRODUCT_PLAN_UNAVAILABLE"}},status);
const planKeys=["id","displayName","createdByUserId","updatedByUserId","cadence","termWeeks","purchasedUnits","listPriceMinor","currency","enabled","badge","createdAt","updatedAt","version"];
const subKeys=["id","studentProfileId","studentDisplayName","centerId","centerDisplayName","lifecycle","contractualStartsOn","contractualEndsOn","createdAt","updatedAt","createdByUserId","updatedByUserId"];
const historyKeys=["id","occurredAt","actorId","action","previous","next"];
const valueKeys=["displayName","cadence","termWeeks","listPriceMinor","enabled","badge","version"];
function pick(value:unknown,keys:readonly string[]){
 if(!object(value)||keys.some(k=>!Object.hasOwn(value,k)))throw Error("Invalid Core projection");
 return Object.fromEntries(keys.map(k=>[k,value[k]]));
}
function project(value:unknown,route:NonNullable<ReturnType<typeof planRequest>>){
 if(route.relation){
  if(!object(value)||!Array.isArray(value.items)||value.items.length>100||!(value.nextAfter===null||isPlanId(value.nextAfter)))throw Error("Invalid related page");
  const items=value.items.map(item=>{
   const row=pick(item,route.relation==="history"?historyKeys:subKeys);
   if(!isPlanId(row.id))throw Error("Invalid related ID");
   if(route.relation==="history")for(const k of ["previous","next"]){
    if(row[k]===null)continue;
    const v=row[k];if(!object(v))throw Error("Invalid history values");
    row[k]=Object.fromEntries(valueKeys.filter(key=>Object.hasOwn(v,key)).map(key=>{const field=v[key];if(!["string","number","boolean"].includes(typeof field))throw Error("Invalid history field");return [key,field];}));
   }
   return row;
  });
  return {items,nextAfter:value.nextAfter};
 }
 const one=(x:unknown)=>{const row=pick(x,planKeys);if(!isPlanId(row.id)||(route.id!==null&&row.id!==route.id))throw Error("Invalid catalog identity");return row;};
 if(route.id!==null)return one(value);
 if(!Array.isArray(value)||value.length>100)throw Error("Invalid catalog list");
 const rows=value.map(one);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("Duplicate catalog ID");return rows;
}
export async function handleHoProductPlans(request:Request,env:HoEnv):Promise<Response>{
 try{
  const url=new URL(request.url);
  const route=planRequest(url.pathname+url.search,request.method);
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+planHost||request.headers.get("host")!==planHost||url.hash||!route)return fail(404);
  const write=request.method==="PATCH",expected=request.headers.get(planActorHeader);
  if(!isPlanId(expected))return fail(403);
  if(write&&(request.headers.get("origin")!==url.origin||request.headers.get("content-type")?.split(";")[0].trim()!=="application/json"))return fail(403);
  let body:ReturnType<typeof parseCatalogBody>=null;
  if(write){
   const length=request.headers.get("content-length");if(length&&(!/^\d+$/.test(length)||Number(length)>4096))return fail(413);
   const raw=await request.text();if(raw.length>4096)return fail(413);
   body=parseCatalogBody(JSON.parse(raw));if(!body)return fail(400);
  }
  const shell=await authorizeHoShell(request.headers,env);
  const grants=["team.bo.access","billing.view",...(write?["billing.manage"]:[])];
  if(shell.userId!==expected||!grants.every(k=>shell.permissionKeys.includes(k)))return fail(403);
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return fail(401);
  const core=(method:string,path:string,input?:unknown)=>callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{method,path,...(input===undefined?{}:{body:input})},credential.token);
  // Header only fences the actor; current credential and Core still supply all authority.
  const context=await core("GET","context"),data=object(context.body)?context.body.data:null;
  if(context.status!==200)return fail(context.status===401?401:context.status===403?403:503);
  if(!object(data)||data.userId!==expected||data.surface!=="BO"||data.entitled!==true||!Array.isArray(data.permissionKeys)||!grants.every(k=>Array.isArray(data.permissionKeys)&&data.permissionKeys.includes(k)))return fail(403);
  const result=await core(request.method,route.corePath,body??undefined);
  if(result.status!==200)return fail(result.status>=400&&result.status<=599?result.status:502);
  try{
   const data=object(result.body)?result.body.data:undefined;
   return json({data:project(data,route)},200);
  }catch{return fail(502);}
 }catch(e){if(e instanceof BoShellGateError||e instanceof TeamAuthError)return fail(e.status);if(e instanceof SyntaxError)return fail(400);return fail(503);}
}
