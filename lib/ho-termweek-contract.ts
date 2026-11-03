import {calendarDate,object,termUuid,timestamp} from './ho-global-terms-contract';
export const WEEK_API='/api/ho/workforce/global-termweeks';
export const WEEK_PERMISSION='operating_cycle.global_week.manage';
export type WeekAction='create'|'update'|'delete'|'lock';
export type WeekAudit={id:string;occurredAt:string;actorId:string|null;action:string;reason:string;changes:{field:string;before:string|number|boolean|null;after:string|number|boolean|null}[]};
export type HoWeek={id:string;termId:string;name:string;code:string;ordinal:number;startDate:string;endDate:string;rhythmKey:string;updatedAt:string;createdAt:string;global_week_registration_locked:boolean;lockVersion:number;referenceCount:number;deletionEligible:boolean};
export type HoWeekDetail=HoWeek&{parent:{id:string;name:string;startDate:string;endDate:string};history:WeekAudit[]};
const nonnegative=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max;
export function weekRequest(path:string,method:string){if(path===WEEK_API)return method==='GET'||method==='POST';const m=path.slice(WEEK_API.length).match(/^\/([^/]+)(?:\/(update|delete))?$/);return path.startsWith(WEEK_API+'/')&&!!m&&termUuid.test(m[1]!)&&(m[2]?method==='POST':method==='GET');}
export function parseWeek(raw:unknown,parentName:string):HoWeek|null{
 const w=object(raw);if(!w||typeof w.id!=='string'||!termUuid.test(w.id)||typeof w.termId!=='string'||!termUuid.test(w.termId)||!text(w.code,96)||!nonnegative(w.ordinal)||Number(w.ordinal)<1||!calendarDate(w.startDate)||!calendarDate(w.endDate)||w.endDate<w.startDate||!text(w.rhythmKey,96)||!timestamp(w.updatedAt)||!timestamp(w.createdAt)||typeof w.global_week_registration_locked!=='boolean'||!nonnegative(w.lockVersion)||!nonnegative(w.referenceCount)||typeof w.deletionEligible!=='boolean'||w.deletionEligible!==(w.referenceCount===0))return null;
 return {id:w.id,termId:w.termId,name:parentName+' · '+w.code,code:w.code,ordinal:Number(w.ordinal),startDate:w.startDate,endDate:w.endDate,rhythmKey:w.rhythmKey,updatedAt:w.updatedAt,createdAt:w.createdAt,global_week_registration_locked:w.global_week_registration_locked,lockVersion:Number(w.lockVersion),referenceCount:Number(w.referenceCount),deletionEligible:w.deletionEligible};
}
export function parseWeekList(body:unknown){const d=object(object(body)?.data);if(!d||!Array.isArray(d.terms)||!Array.isArray(d.termWeeks))return null;const parents=new Map<string,string>();for(const raw of d.terms){const t=object(raw);if(!t||t.scopeType!=='GLOBAL'||typeof t.id!=='string'||!termUuid.test(t.id)||!text(t.displayName,160)||!calendarDate(t.startDate)||!calendarDate(t.endDate))return null;parents.set(t.id,t.displayName);}const rows:HoWeek[]=[];for(const raw of d.termWeeks){const w=object(raw);if(!w||!parents.has(String(w.termId)))return null;const parsed=parseWeek(w,parents.get(String(w.termId))!);if(!parsed)return null;rows.push(parsed);}return new Set(rows.map(w=>w.id)).size===rows.length?rows:null;}
const scalar=(v:unknown):string|number|boolean|null=>typeof v==='string'||typeof v==='number'||typeof v==='boolean'?v:null;
export function parseWeekDetail(body:unknown):HoWeekDetail|null{
 const d=object(object(body)?.data),p=object(d?.parent);if(!d||!p||p.scopeType!=='GLOBAL'||p.id!==d.termId||!text(p.displayName,160)||!calendarDate(p.startDate)||!calendarDate(p.endDate)||!Array.isArray(d.history))return null;
 const week=parseWeek(d,p.displayName);if(!week||week.startDate<p.startDate||week.endDate>p.endDate)return null;
 const history:WeekAudit[]=[];for(const raw of d.history){const h=object(raw);if(!h||typeof h.id!=='string'||!termUuid.test(h.id)||!timestamp(h.occurredAt)||!text(h.action,160)||!(h.actorId===null||typeof h.actorId==='string'&&termUuid.test(h.actorId)))return null;
 const payload=object(h.payload),before=object(payload?.before),after=object(payload?.after),changes:WeekAudit['changes']=[];
 for(const field of ['code','ordinal','startDate','endDate','rhythmKey'])if(before&&after&&before[field]!==after[field])changes.push({field,before:scalar(before[field]),after:scalar(after[field])});
 if(typeof payload?.locked==='boolean')changes.push({field:'global_week_registration_locked',before:scalar(payload.previousLocked),after:payload.locked});
 const reason=typeof payload?.reason==='string'?payload.reason:'';
 if(reason)changes.push({field:'auditReason',before:null,after:reason});
 history.push({id:h.id,occurredAt:h.occurredAt,actorId:h.actorId,action:h.action,reason,changes});}
 return {...week,parent:{id:week.termId,name:p.displayName,startDate:p.startDate,endDate:p.endDate},history};
}
export function parseWeekCommand(raw:unknown,action:Exclude<WeekAction,'lock'>){const b=object(raw);if(!b)return null;const keys=action==='delete'?['expectedUpdatedAt','reason']:['code','ordinal','startDate','endDate','rhythmKey','reason',action==='create'?'termId':'expectedUpdatedAt'];if(Object.keys(b).length!==keys.length||Object.keys(b).some(k=>!keys.includes(k))||!text(b.reason,500)||action!=='create'&&!timestamp(b.expectedUpdatedAt))return null;
 if(action==='delete')return b;
 if(action==='create'&&(typeof b.termId!=='string'||!termUuid.test(b.termId))||!text(b.code,96)||!Number.isSafeInteger(b.ordinal)||Number(b.ordinal)<1||!calendarDate(b.startDate)||!calendarDate(b.endDate)||b.endDate<b.startDate||typeof b.rhythmKey!=='string'||b.rhythmKey.length>96||!(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/).test(b.rhythmKey))return null;return b;}
