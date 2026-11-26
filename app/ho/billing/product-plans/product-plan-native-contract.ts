// PAP-2365 / PLT-PRODUCT-PLAN: exact deployed Core catalog contract, feature-local injected port.
import type {ModuleRow} from "@/lib/workspace-schema";
import type {PlanFields} from "./schema";
import {memoryCatalogJournal,type CatalogJournal} from "./product-plan-pending-journal";
export const catalogPath="/api/ho/billing/product-plans";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isPlanId=(x:unknown):x is string=>typeof x==="string"&&uuid.test(x);
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const integer=(x:unknown,min:number,max=Number.MAX_SAFE_INTEGER):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=min&&x<=max;
const instant=(x:unknown):x is string=>typeof x==="string"&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const date=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const name=(x:unknown):x is string=>typeof x==="string"&&x.trim().length>0&&x.trim().length<=120&&![...x].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);
const badge=(x:unknown):x is "ENTRY"|"HERO"|"STANDARD"=>x==="ENTRY"||x==="HERO"||x==="STANDARD";
const term=(x:unknown):x is 12|24|48=>x===12||x===24||x===48;
const nullableId=(x:unknown)=>x===null||isPlanId(x);
const nullableText=(x:unknown)=>x===null||typeof x==="string";
const fail=():never=>{throw new Error("Invalid authoritative Product Plan response");};
export function decodePlan(x:unknown):ModuleRow<PlanFields>{
 if(!obj(x)||!isPlanId(x.id)||!name(x.displayName)||x.displayName!==x.displayName.trim()||
 !integer(x.cadence,1,6)||!term(x.termWeeks)||x.purchasedUnits!==x.cadence*x.termWeeks||
 !integer(x.listPriceMinor,0)||x.currency!=="VND"||!badge(x.badge)||typeof x.enabled!=="boolean"||
 !instant(x.createdAt)||!instant(x.updatedAt)||!nullableId(x.createdByUserId)||!nullableId(x.updatedByUserId)||!integer(x.version,1))return fail();
 return {id:x.id,name:x.displayName,cadence:x.cadence,termWeeks:x.termWeeks,price:x.listPriceMinor,badge:x.badge,enabled:x.enabled,
 createdAt:x.createdAt,createdBy:"—",updatedAt:x.updatedAt,updatedBy:"—",planId:x.id,currency:x.currency,version:x.version};
}
const map={name:"displayName",cadence:"cadence",termWeeks:"termWeeks",price:"listPriceMinor",badge:"badge",enabled:"enabled"} as const;
type Field=keyof typeof map;
type Value=string|number|boolean;
const field=(k:string):k is Field=>Object.hasOwn(map,k);
export function encodePlanPatch(patch:unknown,version:unknown){
 if(!obj(patch)||typeof version!=="string"||!(/^[1-9][0-9]*$/).test(version)||!integer(Number(version),1))return null;
 const keys=Object.keys(patch);if(!keys.length||keys.some(k=>!field(k)))return null;
 const body:Record<string,Value>={expectedVersion:Number(version)};
 const expected:Partial<Record<Field,Value>>={};
 for(const k of keys){
  if(!field(k))return null;
  const v=patch[k];let normalized:Value;
  switch(k){
   case "name":if(!name(v))return null;normalized=v.trim();break;
   case "cadence":if(!integer(v,1,6))return null;normalized=v;break;
   case "termWeeks":if(!term(v))return null;normalized=v;break;
   case "price":if(!integer(v,0))return null;normalized=v;break;
   case "badge":if(!badge(v))return null;normalized=v;break;
   case "enabled":if(typeof v!=="boolean")return null;normalized=v;break;
  }
  body[map[k]]=normalized;expected[k]=normalized;
 }
 return {body:Object.freeze(body),expected:Object.freeze(expected)};
}
export type CatalogPort=(path:string,init:{method:"GET"|"PATCH";signal:AbortSignal;body?:Readonly<Record<string,Value>>})=>Promise<{status:number;data:unknown}>;
export class CatalogRequestError extends Error{constructor(readonly status:number){super("Product Plan request not accepted");}}
export class CatalogOutcomeUnknown extends Error{constructor(readonly planId:string,readonly expectedVersion:string){super("Product Plan update outcome not verified; reload before editing");}}
function pagePath(id:string,relation:"subscriptions"|"history",after:string|null,limit:number){
 if(!isPlanId(id)||(after!==null&&!isPlanId(after))||!integer(limit,1,100))throw new CatalogRequestError(400);
 const q=new URLSearchParams({limit:String(limit)});if(after)q.set("after",after);
 return catalogPath+"/"+id+"/"+relation+"?"+q;
}
export function decodePage<T>(x:unknown,decode:(v:unknown)=>T&{id:string},limit:number,after:string|null,descending=false){
 if(!obj(x)||!Array.isArray(x.items)||x.items.length>limit||!(x.nextAfter===null||isPlanId(x.nextAfter)))return fail();
 const items=x.items.map(decode);const ids=items.map(r=>r.id);
 if(new Set(ids).size!==ids.length||ids.some((id,i)=>{const prior=i?ids[i-1]:after;return prior!==null&&(descending?id>=prior:id<=prior);})||
 (x.nextAfter!==null&&(items.length!==limit||x.nextAfter!==ids.at(-1))))return fail();
 return {items,nextAfter:x.nextAfter};
}
export function decodeSubscription(x:unknown){
 if(!obj(x)||!isPlanId(x.id)||!isPlanId(x.studentProfileId)||!nullableText(x.studentDisplayName)||!nullableId(x.centerId)||!nullableText(x.centerDisplayName)||
 typeof x.lifecycle!=="string"||!["DRAFT","ACTIVE","CANCELLED","SUPERSEDED","COMPLETED"].includes(x.lifecycle)||
 !(x.contractualStartsOn===null||date(x.contractualStartsOn))||!(x.contractualEndsOn===null||date(x.contractualEndsOn))||
 !instant(x.createdAt)||!instant(x.updatedAt)||!nullableId(x.createdByUserId)||x.updatedByUserId!==null)return fail();
 return {id:x.id,student:typeof x.studentDisplayName==="string"?x.studentDisplayName:"—",center:typeof x.centerDisplayName==="string"?x.centerDisplayName:"—",
 status:x.lifecycle,startsOn:x.contractualStartsOn,endsOn:x.contractualEndsOn,createdAt:x.createdAt,updatedAt:x.updatedAt,createdBy:"—",updatedBy:"—"};
}
function historyValues(x:unknown){
 if(x===null)return null;if(!obj(x))return fail();
 const result:Record<string,Value>={};
 for(const [k,v] of Object.entries(x)){
  switch(k){
   case "displayName":if(!name(v))return fail();break;
   case "cadence":if(!integer(v,1,6))return fail();break;
   case "termWeeks":if(!term(v))return fail();break;
   case "listPriceMinor":if(!integer(v,0))return fail();break;
   case "enabled":if(typeof v!=="boolean")return fail();break;
   case "badge":if(!badge(v))return fail();break;
   case "version":if(!integer(v,1))return fail();break;
   default:return fail();
  }
  result[k]=v as Value;
 }
 return result;
}
export function decodeHistory(x:unknown){
 if(!obj(x)||!isPlanId(x.id)||!instant(x.occurredAt)||!nullableId(x.actorId)||x.action!=="billing.product_plan_updated")return fail();
 return {id:x.id,at:x.occurredAt,actor:"—",action:x.action,previous:historyValues(x.previous),next:historyValues(x.next)};
}
export function createProductPlanClient(port:CatalogPort,journal:CatalogJournal=memoryCatalogJournal(),expectedActor?:string){
 if(expectedActor!==undefined&&!isPlanId(expectedActor))throw Error("Invalid expected actor");
 let busy=false;
 async function read(path:string,signal:AbortSignal){
  signal.throwIfAborted();const r=await port(path,{method:"GET",signal});signal.throwIfAborted();
  if(r.status!==200)throw new CatalogRequestError(r.status);return r.data;
 }
 async function detailReceipt(id:string,signal:AbortSignal){
  if(!isPlanId(id))throw new CatalogRequestError(400);
  const raw=await read(catalogPath+"/"+id,signal),row=decodePlan(raw);if(row.id!==id||!obj(raw))return fail();return {row,createdBy:raw.createdByUserId,updatedBy:raw.updatedByUserId};
 }
 async function detail(id:string,signal:AbortSignal){return (await detailReceipt(id,signal)).row;}
 return {
  async list(signal:AbortSignal){const x=await read(catalogPath,signal);if(!Array.isArray(x))return fail();const rows=x.map(decodePlan);if(new Set(rows.map(r=>r.id)).size!==rows.length)return fail();return rows;},
  detail,
  pending:()=>journal.read(),
  async recover(signal:AbortSignal){
   const pending=journal.read();if(!pending)return {status:"none" as const};
   if(busy)return {status:"pending" as const};
   const row=await detail(pending.planId,signal);
   if(typeof row.version!=="number"||row.version<=Number(pending.expectedVersion))return {status:"pending" as const,row};
   journal.clear(pending);return {status:"version-advanced" as const,row};
  },
  async update(id:string,patch:unknown,version:string,signal:AbortSignal){
   if(!isPlanId(id))throw new CatalogRequestError(400);
   const command=encodePlanPatch(patch,version);if(!command)throw new CatalogRequestError(400);
   if(busy)throw new CatalogRequestError(409);signal.throwIfAborted();
   const pending=journal.read();if(pending)throw new CatalogOutcomeUnknown(pending.planId,pending.expectedVersion);
   const marker={planId:id,expectedVersion:version};journal.begin(marker);busy=true;
   try{
    // Never retry a dispatched PATCH. An uncertain receipt is not success or a conflict.
    let r:{status:number;data:unknown};
    try{r=await port(catalogPath+"/"+id,{method:"PATCH",body:command.body,signal});signal.throwIfAborted();}
    catch{throw new CatalogOutcomeUnknown(id,version);}
    if([400,401,403,404,409,422].includes(r.status)){journal.clear(marker);throw new CatalogRequestError(r.status);}
    try{
     if(r.status!==200)return fail();
     const receipt=decodePlan(r.data);
     const matches=(row:ModuleRow<PlanFields>)=>row.id===id&&row.version===Number(version)+1&&Object.entries(command.expected).every(([k,v])=>field(k)&&row[k]===v);
     if(!matches(receipt))return fail();
     if(!obj(r.data)||(expectedActor!==undefined&&r.data.updatedByUserId!==expectedActor))return fail();
     const actual=await detailReceipt(id,signal);
     if(!matches(actual.row)||JSON.stringify(actual.row)!==JSON.stringify(receipt)||actual.createdBy!==r.data.createdByUserId||actual.updatedBy!==r.data.updatedByUserId)return fail();
     journal.clear(marker);return actual.row;
    }catch{throw new CatalogOutcomeUnknown(id,version);}
   }finally{busy=false;}
  },
  async subscriptions(id:string,signal:AbortSignal,after:string|null=null,limit=25){return decodePage(await read(pagePath(id,"subscriptions",after,limit),signal),decodeSubscription,limit,after);},
  async history(id:string,signal:AbortSignal,after:string|null=null,limit=25){return decodePage(await read(pagePath(id,"history",after,limit),signal),decodeHistory,limit,after,true);},
 };
}
