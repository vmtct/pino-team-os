/** PAP-2371: typed client for the exact private HO Learning Space contract. */
const root="/api/ho/learning-spaces",ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type SpaceStatus="ACTIVE"|"INACTIVE"|"ARCHIVED";
export type SpaceFields={centerId:string;code:string;displayName:string;optimalConcurrentCapacity:number;hardConcurrentCapacity:number|null;status:SpaceStatus};
export type SpaceReceipt=SpaceFields&{id:string;version:number};
export type SpaceDto=SpaceReceipt&{centerName:string;createdAt:string;updatedAt:string;createdBy:string|null;updatedBy:string|null;activeClassCount:number;referenceCount:number};
export type SpaceClass={id:string;displayName:string;centerId:string;pathProgramId:string;status:SpaceStatus;version:number};
export type SpaceHistory={id:string;occurredAt:string;action:string;actorName:string|null};
export class SpaceApiError extends Error{constructor(readonly status:number,readonly uncertain:boolean){super("Learning Space request unavailable");}}
const fail=():never=>{throw Error("Invalid Learning Space contract");};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const id=(v:unknown):string=>typeof v==="string"&&ID.test(v)?v:fail();
const str=(v:unknown):string=>typeof v==="string"&&v.trim()===v&&v.length>0?v:fail();
const nullable=(v:unknown):string|null=>v===null?null:str(v);
const num=(v:unknown,min=1):number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min?v:fail();
const date=(v:unknown):string=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:fail();
const status=(v:unknown):SpaceStatus=>v==="ACTIVE"||v==="INACTIVE"||v==="ARCHIVED"?v:fail();
function fields(v:unknown):SpaceFields{const r=obj(v),code=str(r.code),displayName=str(r.displayName),optimalConcurrentCapacity=num(r.optimalConcurrentCapacity),hardConcurrentCapacity=r.hardConcurrentCapacity===null?null:num(r.hardConcurrentCapacity);if(code.length>64||displayName.length>200||hardConcurrentCapacity!==null&&hardConcurrentCapacity<optimalConcurrentCapacity)fail();return {centerId:id(r.centerId),code,displayName,optimalConcurrentCapacity,hardConcurrentCapacity,status:status(r.status)};}
function receipt(v:unknown):SpaceReceipt{const r=obj(v);return {...fields(r),id:id(r.id),version:num(r.version)};}
export function decodeSpace(v:unknown):SpaceDto{const r=obj(v),activeClassCount=num(r.activeClassCount,0),referenceCount=num(r.referenceCount,0);if(activeClassCount>referenceCount)fail();return {...receipt(r),centerName:str(r.centerName),createdAt:date(r.createdAt),updatedAt:date(r.updatedAt),createdBy:nullable(r.createdBy),updatedBy:nullable(r.updatedBy),activeClassCount,referenceCount};}
function decodeClass(v:unknown):SpaceClass{const r=obj(v);return {id:id(r.id),displayName:str(r.displayName),centerId:id(r.centerId),pathProgramId:id(r.pathProgramId),status:status(r.status),version:num(r.version)};}
function decodeHistory(v:unknown):SpaceHistory{const r=obj(v),action=str(r.action);if(!["delivery.learning_space_created","delivery.learning_space_updated","delivery.learning_space_deleted"].includes(action))fail();return {id:id(r.id),occurredAt:date(r.occurredAt),action,actorName:nullable(r.actorName)};}
function page<T extends {id:string}>(v:unknown,decode:(v:unknown)=>T,after:string|null,descending=false){const r=obj(v);if(!Array.isArray(r.items)||r.items.length>100)fail();const items=(r.items as unknown[]).map(decode),nextAfter=r.nextAfter===null?null:id(r.nextAfter),wrong=(x:string,y:string)=>descending?x>=y:x<=y;if(items.some((x,i)=>i>0&&wrong(x.id,items[i-1]!.id)||after!==null&&wrong(x.id,after))||nextAfter!==null&&nextAfter!==items.at(-1)?.id)fail();return {items,nextAfter};}
function key(k:string){if(typeof k!=="string"||k.trim()!==k||k.length<8||k.length>160)fail();return k;}
function sameFields(a:SpaceFields,b:SpaceFields){return a.centerId===b.centerId&&a.code===b.code.toLowerCase()&&a.displayName===b.displayName&&a.status===b.status&&a.optimalConcurrentCapacity===b.optimalConcurrentCapacity&&a.hardConcurrentCapacity===b.hardConcurrentCapacity;}
export function createLearningSpaceClient(fetcher:typeof fetch=fetch){
 async function call(path:string,method:string,body?:unknown,k?:string,signal?:AbortSignal){
  const writing=method!=="GET";let r:Response;
  try{r=await fetcher(root+path,{method,cache:"no-store",credentials:"same-origin",signal,headers:{accept:"application/json",...(writing?{"content-type":"application/json","idempotency-key":key(k??"")}: {})},...(writing?{body:JSON.stringify(body)}:{})});}
  catch{throw new SpaceApiError(0,writing);}
  if(!r.ok)throw new SpaceApiError(r.status,writing&&(r.status>=500||r.status===408||r.status===429));
  try{return obj(await r.json()).data;}catch{throw new SpaceApiError(r.status,writing);}
 }
 const query=(after:string|null)=>{const p=new URLSearchParams({limit:"100"});if(after)p.set("after",id(after));return p;};
 return {
  async page(after:string|null=null,signal?:AbortSignal){return page(await call("?"+query(after),"GET",undefined,undefined,signal),decodeSpace,after);},
  async detail(recordId:string,signal?:AbortSignal){const r=decodeSpace(await call("/"+id(recordId),"GET",undefined,undefined,signal));if(r.id!==recordId)fail();return r;},
  async classes(recordId:string,after:string|null=null,signal?:AbortSignal){return page(await call("/"+id(recordId)+"/classes?"+query(after),"GET",undefined,undefined,signal),decodeClass,after);},
  async history(recordId:string,after:string|null=null,signal?:AbortSignal){return page(await call("/"+id(recordId)+"/history?"+query(after),"GET",undefined,undefined,signal),decodeHistory,after,true);},
  async create(input:SpaceFields,k:string){const b=fields(input);key(k);const raw=await call("","POST",b,k);try{const r=receipt(raw);if(r.version!==1||!sameFields(r,b))fail();return r;}catch{throw new SpaceApiError(201,true);}},
  async update(recordId:string,input:SpaceFields,expectedVersion:number,k:string){const b=fields(input);num(expectedVersion);key(k);const raw=await call("/"+id(recordId),"PATCH",{...b,expectedVersion},k);try{const r=receipt(raw);if(r.id!==recordId||r.version!==expectedVersion+1||!sameFields(r,b))fail();return r;}catch{throw new SpaceApiError(200,true);}},
  async remove(recordId:string,centerId:string,expectedVersion:number,k:string){key(k);const raw=await call("/"+id(recordId),"DELETE",{centerId:id(centerId),expectedVersion:num(expectedVersion)},k);try{const r=obj(raw);if(r.id!==recordId||r.deleted!==true)fail();return {id:recordId,deleted:true as const};}catch{throw new SpaceApiError(200,true);}}
 };
}
export async function loadLearningSpaceDirectory(client:Pick<ReturnType<typeof createLearningSpaceClient>,"page">,signal:AbortSignal){const rows:SpaceDto[]=[];let after:string|null=null;for(let i=0;i<100;i++){signal.throwIfAborted();const p=await client.page(after,signal);rows.push(...p.items);if(p.nextAfter===null)return rows;after=p.nextAfter;}throw Error("Learning Space directory exceeds safe bound");}
