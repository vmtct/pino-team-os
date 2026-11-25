/** PAP-2288 — exact BO household API client. No implicit retries or scope selectors. */
export type LeadRole="PARENT"|"STUDENT"|"GUEST";
export type LeadInterest="AFTERSCHOOL_ART"|"AFTERSCHOOL_PIANO"|"MYTIME_ACRYLIC"|"MYTIME_PIANO";
export interface LeadContactInput {phone:string;contactDisplayName:string|null}
export interface LeadMemberInput {displayName:string;intendedRoles:LeadRole[];gender:"MALE"|"FEMALE"|"OTHER"|"UNSPECIFIED"|null;birthPrecision:"UNKNOWN"|"YEAR"|"MONTH"|"FULL";birthYear:number|null;birthMonth:number|null;birthDay:number|null;reportedAge:number|null;interestKinds:LeadInterest[]}
export interface LeadMember extends LeadMemberInput {id:string;status:"ACTIVE";version:number;ageObservedAt:string|null}
export interface LeadRelationInput {fromMemberId:string;toMemberId:string;relationLabel:string}
export interface LeadRelation extends LeadRelationInput {id:string;status:"DECLARED"|"CONFIRMED";version:number}
export interface LeadIntent {id:string;kind:"OPEN_STUDIO"|"PROGRAM_INTEREST"|"GENERAL_INQUIRY";sourceBrand:"PINO_HOUSE"|"TOPPI";sourceSurface:"PINO_HOUSE_WEB"|"TOPPI_WEB"|"STAFF";status:"SUBMITTED"|"CONTACTED"|"CONTACT_VERIFIED"|"CLOSED";createdAt:string;version:number}
export interface LeadRow extends LeadContactInput {id:string;status:"ACTIVE"|"ARCHIVED";primaryContactMemberId:string|null;version:number;createdAt:string;updatedAt:string;createdBy:string|null;updatedBy:string|null;centerId:string|null;memberCount:number;intentCount:number}
export interface LeadDetail extends LeadRow {members:LeadMember[];relationships:LeadRelation[];intents:LeadIntent[];intentHistoryHasMore:boolean}
export interface LeadPage<T> {items:T[];hasMore:boolean;nextCursor:string|null}
export interface LeadSearch {q?:string;status?:"ACTIVE"|"ARCHIVED";program?:"AFTERSCHOOL"|"MYTIME";path?:"ART"|"PIANO";sort?:"UPDATED_DESC"|"CREATED_DESC";limit?:number;cursor?:string}
export interface LeadCreate {contact:LeadContactInput;members?:LeadMemberInput[];primaryMemberIndex?:number|null}
export interface LeadReceipt {leadId:string;version:number}
export interface LeadCreateReceipt extends LeadReceipt {created:boolean}
export interface LeadMemberReceipt extends LeadReceipt {memberId:string|null}
export interface LeadRelationReceipt extends LeadReceipt {relationshipId:string}
export class LeadApiError extends Error {
 constructor(readonly status:number,readonly code:string,readonly requestId:string|null){super("Lead request failed ("+status+")");this.name="LeadApiError";}
}
const base="/api/bo/acquisition/households";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(value:string){if(!uuid.test(value))throw new LeadApiError(400,"INVALID_LEAD_ID",null);return value;}
function version(value:number){if(!Number.isSafeInteger(value)||value<1)throw new LeadApiError(400,"INVALID_LEAD_VERSION",null);return value;}
function key(value:string){if(!/^[A-Za-z0-9_-]{16,128}$/.test(value))throw new LeadApiError(400,"INVALID_IDEMPOTENCY_KEY",null);return value;}
export function newLeadCommandKey(){return crypto.randomUUID();}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value);}
function isPage(value:unknown):boolean{return object(value)&&Array.isArray(value.items)&&typeof value.hasMore==="boolean"&&(value.nextCursor===null||typeof value.nextCursor==="string")&&value.hasMore===(typeof value.nextCursor==="string"&&value.nextCursor.length>0);}
function isReceipt(value:unknown):boolean{return object(value)&&typeof value.leadId==="string"&&uuid.test(value.leadId)&&typeof value.version==="number"&&Number.isSafeInteger(value.version)&&value.version>0;}
function isDetail(value:unknown):boolean{return object(value)&&typeof value.id==="string"&&uuid.test(value.id)&&typeof value.version==="number"&&Number.isSafeInteger(value.version)&&value.version>0&&Array.isArray(value.members)&&Array.isArray(value.relationships)&&Array.isArray(value.intents)&&typeof value.intentHistoryHasMore==="boolean";}
export function createLeadHouseholdApi(fetcher:typeof fetch=fetch){
 async function request<T>(suffix:string,method:"GET"|"POST",validate:(value:unknown)=>boolean,body?:unknown,commandKey?:string,signal?:AbortSignal):Promise<T>{
  const response=await fetcher(base+suffix,{method,cache:"no-store",credentials:"same-origin",...(signal?{signal}:{}),...(method==="POST"?{headers:{"content-type":"application/json",...(commandKey===undefined?{}:{"idempotency-key":key(commandKey)})},body:JSON.stringify(body)}:{})});
  const requestId=response.headers.get("x-request-id");
  let payload:unknown;try{payload=await response.json();}catch{throw new LeadApiError(response.ok?502:response.status,"LEAD_RESPONSE_INVALID",requestId);}
  if(!response.ok){const code=object(payload)&&object(payload.error)&&typeof payload.error.code==="string"&&/^[A-Z][A-Z0-9_]{0,100}$/.test(payload.error.code)?payload.error.code:"LEAD_REQUEST_FAILED";throw new LeadApiError(response.status,code,requestId);}
  if(!object(payload)||!validate(payload.data))throw new LeadApiError(502,"LEAD_RESPONSE_INVALID",requestId);
  return payload.data as T;
 }
 const command=<T extends LeadReceipt>(leadId:string,suffix:string,expectedVersion:number,body:Record<string,unknown>,commandKey:string,validate:(v:unknown)=>boolean=isReceipt)=>request<T>("/"+id(leadId)+suffix,"POST",validate,{...body,expectedVersion:version(expectedVersion)},commandKey);
 return {
  search:(input:LeadSearch={},signal?:AbortSignal)=>request<LeadPage<LeadRow>>("/search","POST",isPage,input,undefined,signal),
  detail:(leadId:string,signal?:AbortSignal)=>request<LeadDetail>("/"+id(leadId),"GET",isDetail,undefined,undefined,signal),
  history:(leadId:string,input:{limit?:number;cursor?:string}={},signal?:AbortSignal)=>{const p=new URLSearchParams();if(input.limit!==undefined)p.set("limit",String(input.limit));if(input.cursor!==undefined)p.set("cursor",input.cursor);return request<LeadPage<LeadIntent>>("/"+id(leadId)+"/history"+(p.size?"?"+p.toString():""),"GET",isPage,undefined,undefined,signal);},
  create:(input:LeadCreate,commandKey:string)=>request<LeadCreateReceipt>("","POST",v=>isReceipt(v)&&object(v)&&typeof v.created==="boolean",input,commandKey),
  contact:(leadId:string,expectedVersion:number,contact:LeadContactInput,commandKey:string)=>command<LeadReceipt>(leadId,"/contact",expectedVersion,{contact},commandKey),
  addMember:(leadId:string,expectedVersion:number,member:LeadMemberInput,commandKey:string)=>command<LeadMemberReceipt>(leadId,"/members",expectedVersion,{member},commandKey),
  updateMember:(leadId:string,memberId:string,expectedVersion:number,member:LeadMemberInput,commandKey:string)=>command<LeadMemberReceipt>(leadId,"/members/"+id(memberId)+"/update",expectedVersion,{member},commandKey),
  retireMember:(leadId:string,memberId:string,expectedVersion:number,commandKey:string)=>command<LeadMemberReceipt>(leadId,"/members/"+id(memberId)+"/retire",expectedVersion,{},commandKey),
  primary:(leadId:string,expectedVersion:number,memberId:string|null,commandKey:string)=>command<LeadMemberReceipt>(leadId,"/primary",expectedVersion,{memberId:memberId===null?null:id(memberId)},commandKey),
  addRelation:(leadId:string,expectedVersion:number,relationship:LeadRelationInput,commandKey:string)=>command<LeadRelationReceipt>(leadId,"/relationships",expectedVersion,{relationship},commandKey),
  updateRelation:(leadId:string,relationshipId:string,expectedVersion:number,relationship:LeadRelationInput,commandKey:string)=>command<LeadRelationReceipt>(leadId,"/relationships/"+id(relationshipId)+"/update",expectedVersion,{relationship},commandKey),
  confirmRelation:(leadId:string,relationshipId:string,expectedVersion:number,commandKey:string)=>command<LeadRelationReceipt>(leadId,"/relationships/"+id(relationshipId)+"/confirm",expectedVersion,{},commandKey),
  retireRelation:(leadId:string,relationshipId:string,expectedVersion:number,commandKey:string)=>command<LeadRelationReceipt>(leadId,"/relationships/"+id(relationshipId)+"/retire",expectedVersion,{},commandKey),
  archive:(leadId:string,expectedVersion:number,reason:string,commandKey:string)=>command<LeadReceipt>(leadId,"/archive",expectedVersion,{reason},commandKey),
 };
}
