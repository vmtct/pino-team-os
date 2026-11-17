/** PAP-2030 / PNR-WISH — exact HO configuration read/CAS contract, unmounted. */
type JsonRecord=Record<string,unknown>;
type Scope="policy"|"banner";
type Base={name:string;actorUserId:string;createdAt:string};
type Draft<T>=Base&{version:number;basePointerVersion:number;value:T};
type Published<T>=Base&{id:string;sequence:number;value:T};
export type WishConfigHead<T>=Readonly<{recordId:string;pointerVersion:number;active:boolean;published:Published<T>|null;latestDraft:Draft<T>|null;pendingDraft:Draft<T>|null;staleDraft:boolean}>;
const invalid=():never=>{throw Error("Dữ liệu cấu hình Wish không hợp lệ hoặc đã thay đổi.");};
function object(v:unknown):JsonRecord{if(!v||typeof v!=="object"||Array.isArray(v))return invalid();return v as JsonRecord;}
function id(v:unknown):string{if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v))return invalid();return v;}
function text(v:unknown,max=160):string{if(typeof v!=="string"||!v.trim()||v!==v.trim()||v.length>max)return invalid();return v;}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)return invalid();return v;}
function flag(v:unknown):boolean{if(typeof v!=="boolean")return invalid();return v;}
function iso(v:unknown):string{if(typeof v!=="string"||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)return invalid();return v;}
function json(v:unknown):unknown{if(typeof v!=="string")return invalid();try{return JSON.parse(v) as unknown;}catch{return invalid();}}
function finite(v:unknown,min:number,max:number):number{if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)return invalid();return v;}
export type PolicyValue={centerId:string;cost:number;definition:{rates:[number,number,number];hard4:number;hard5:number;soft5:number;curve:{position:number;rate:number}[];featuredGuarantee:boolean}};
export type BannerPoolItem={itemId:string;revision:number;weight:number;featured:boolean};
export type BannerValue={bannerId:string;centerId:string|null;familyId:string;startsAt:string;endsAt:string;pool:readonly (BannerPoolItem&{rarity?:3|4|5})[]};
function policy(r:JsonRecord,recordId:string):PolicyValue{
 if(id(r.center_id)!==recordId)return invalid();
 const d=object(json(r.definition_json)),rates=d.rates;
 if(!Array.isArray(rates)||rates.length!==3||!Array.isArray(d.curve))return invalid();
 const parsed:[number,number,number]=[finite(rates[0],0,1),finite(rates[1],0,1),finite(rates[2],0,1)];
 const hard4=integer(d.hard4,1),hard5=integer(d.hard5,1),soft5=integer(d.soft5,1);
 if(hard4>hard5||soft5>=hard5||Math.abs(parsed.reduce((s,v)=>s+v,0)-1)>1e-10||d.curve.length!==hard5-soft5+1)return invalid();
 let prior=parsed[2];
 const curve=d.curve.map((v,i)=>{const s=object(v),position=integer(s.position,1),rate=finite(s.rate,0,1);if(position!==soft5+i||rate<prior)return invalid();prior=rate;return {position,rate};});
 if(prior!==1)return invalid();
 return {centerId:recordId,cost:integer(r.unit_cost,1,1000000),definition:{rates:parsed,hard4,hard5,soft5,curve,featuredGuarantee:flag(d.featuredGuarantee)}};
}
function banner(r:JsonRecord,recordId:string,published:boolean):BannerValue{
 if(id(r.banner_id)!==recordId)return invalid();
 const raw=json(r.pool_json),startsAt=iso(r.starts_at),endsAt=iso(r.ends_at);
 if(!Array.isArray(raw)||!raw.length||raw.length>500||startsAt>=endsAt)return invalid();
 const pool=raw.map((v):BannerPoolItem&{rarity?:3|4|5}=>{const i=object(v),weight=finite(i.weight,0,Number.MAX_VALUE);if(weight<=0)return invalid();
 const base={itemId:id(i.itemId),revision:integer(i.revision,1),weight,featured:flag(i.featured)};
 if(!published){if(Object.hasOwn(i,"rarity"))return invalid();return base;}
 const rarity=i.rarity;if(rarity!==3&&rarity!==4&&rarity!==5)return invalid();return {...base,rarity};});
 if(new Set(pool.map(i=>i.itemId)).size!==pool.length)return invalid();
 return {bannerId:recordId,centerId:r.center_id===null?null:id(r.center_id),familyId:text(r.family_id),startsAt,endsAt,pool};
}
function base(r:JsonRecord):Base{return {name:text(r.name),actorUserId:id(r.actor_user_id),createdAt:iso(r.created_at)};}
function parse<T>(raw:unknown,recordValue:(r:JsonRecord,id:string,published:boolean)=>T):WishConfigHead<T>{
 const r=object(raw),recordId=id(r.recordId),pointerVersion=integer(r.pointerVersion),active=flag(r.active),staleDraft=flag(r.staleDraft);
 const draft=(v:unknown):Draft<T>|null=>{if(v===null)return null;const d=object(v);return {...base(d),version:integer(d.version,1),basePointerVersion:integer(d.base_pointer_version),value:recordValue(d,recordId,false)};};
 const latestDraft=draft(r.latestDraft),pendingDraft=draft(r.pendingDraft);
 const published=r.published===null?null:(()=>{const p=object(r.published);return {...base(p),id:id(p.id),sequence:integer(p.sequence,1),value:recordValue(p,recordId,true)};})();
 if((pointerVersion===0&&!pendingDraft)||(pointerVersion===0)!==(published===null)||active&&!published||!latestDraft||latestDraft.basePointerVersion>pointerVersion||pendingDraft&&JSON.stringify(pendingDraft)!==JSON.stringify(latestDraft)||staleDraft!==!!(pendingDraft&&pendingDraft.basePointerVersion!==pointerVersion))return invalid();
 return {recordId,pointerVersion,active,published,latestDraft,pendingDraft,staleDraft};
}
export const parsePolicyHead=(raw:unknown)=>parse(raw,policy);
export const parseBannerHead=(raw:unknown)=>parse(raw,banner);
export function publishWishDraft<T>(scope:Scope,h:WishConfigHead<T>){
 if(!h.pendingDraft||h.staleDraft||h.pendingDraft.basePointerVersion!==h.pointerVersion)return invalid();
 const versions={draftVersion:h.pendingDraft.version,expectedPointerVersion:h.pointerVersion};
 return scope==="policy"?{action:"publishPolicy",body:{centerId:h.recordId,...versions}}:{action:"publishBanner",body:{bannerId:h.recordId,...versions}};
}
export function retireWishRevision<T>(scope:Scope,h:WishConfigHead<T>,reason:string){
 if(!h.active||!h.published)return invalid();
 const versions={revisionId:h.published.id,expectedPointerVersion:h.pointerVersion,reason:text(reason.trim(),1000)};
 return scope==="policy"?{action:"retirePolicy",body:{centerId:h.recordId,...versions}}:{action:"retireBanner",body:{bannerId:h.recordId,...versions}};
}

type DraftInput = {name:string;expectedDraftVersion:number;expectedPointerVersion:number};
function draftVersions<T>(recordId:string,head:WishConfigHead<T>|null):Pick<DraftInput,"expectedDraftVersion"|"expectedPointerVersion">{
 if(head&&head.recordId!==recordId)return invalid();
 return {expectedDraftVersion:head?.latestDraft?.version??0,expectedPointerVersion:head?.pointerVersion??0};
}
export function savePolicyDraft(value:PolicyValue,name:string,head:WishConfigHead<PolicyValue>|null){
 const recordId=id(value.centerId);
 const validated=policy({center_id:recordId,unit_cost:value.cost,definition_json:JSON.stringify(value.definition)},recordId);
 return {action:"savePolicy" as const,body:{...validated,name:text(name.trim()),...draftVersions(recordId,head)}};
}
export function saveBannerDraft(value:Omit<BannerValue,"pool">&{pool:readonly BannerPoolItem[]},name:string,head:WishConfigHead<BannerValue>|null){
 const recordId=id(value.bannerId);
 // Serialize only editable concrete Item revision fields; rarity is server-resolved.
 const pool=value.pool.map(i=>({itemId:i.itemId,revision:i.revision,weight:i.weight,featured:i.featured}));
 const validated=banner({banner_id:recordId,center_id:value.centerId,family_id:value.familyId,starts_at:value.startsAt,ends_at:value.endsAt,pool_json:JSON.stringify(pool)},recordId,false);
 const body={...validated,pool,name:text(name.trim()),...draftVersions(recordId,head)};
 if(head?.published&&head.published.value.familyId!==body.familyId)return invalid();
 return {action:"saveBanner" as const,body};
}
type SaveDraft=ReturnType<typeof savePolicyDraft>|ReturnType<typeof saveBannerDraft>;
export function confirmSavedWishDraft(command:SaveDraft,receipt:unknown,readback:unknown){
 const body=command.body,r=object(receipt);
 const recordId=command.action==="savePolicy"?command.body.centerId:command.body.bannerId;
 const key=command.action==="savePolicy"?"centerId":"bannerId";
 if(id(r[key])!==recordId||integer(r.draftVersion,1)!==body.expectedDraftVersion+1||integer(r.basePointerVersion)!==body.expectedPointerVersion)return invalid();
 const h=command.action==="savePolicy"?parsePolicyHead(readback):parseBannerHead(readback);
 if(h.recordId!==recordId||h.pointerVersion!==body.expectedPointerVersion||h.staleDraft||!h.pendingDraft||h.pendingDraft.version!==r.draftVersion||h.pendingDraft.basePointerVersion!==r.basePointerVersion||h.pendingDraft.name!==body.name)return invalid();
 const {name: _name,expectedDraftVersion: _draft,expectedPointerVersion: _pointer,...value}=body;
 void _name;void _draft;void _pointer;
 if(JSON.stringify(h.pendingDraft.value)!==JSON.stringify(value))return invalid();
 return h;
}
