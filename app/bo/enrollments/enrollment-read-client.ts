/** PAP-2181: read-only Enrollment directory; the server authorizes every page. */
import type {EnrollmentRow} from "./BoEnrollmentDirectory";
import {BoApiError} from "@/lib/bo-api-error";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Phản hồi lịch học không hợp lệ.");return v as Record<string,unknown>;};
const id=(v:unknown)=>{if(typeof v!=="string"||!UUID.test(v))throw Error("Định danh lịch học không hợp lệ.");return v;};
const label=(v:unknown)=>{if(typeof v!=="string"||!v.trim())throw Error("Tên hồ sơ lịch học không hợp lệ.");return v;};
const day=(v:unknown)=>{if(typeof v!=="string"||!DATE.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error("Ngày hiệu lực không hợp lệ.");return v;};
const stamp=(v:unknown)=>{if(v==null)return null;if(typeof v!=="string"||!Number.isFinite(Date.parse(v)))throw Error("Audit timestamp không hợp lệ.");return v;};
export type EnrollmentRelations=Readonly<{studentId:string;subscriptionId:string;runningClassId:string}>;
export type EnrollmentRead={row:EnrollmentRow;relations:EnrollmentRelations};
type Cursor={createdAt:string;id:string};
function project(input:unknown):EnrollmentRead{
 const r=object(input),start=day(r.effectiveFromLocalDate),end=r.effectiveUntilExclusiveLocalDate===null?null:day(r.effectiveUntilExclusiveLocalDate);
 if(end!==null&&end<=start)throw Error("Khoảng hiệu lực không hợp lệ.");
 const weekday=r.weekdayIso,from=r.scheduleStartsLocal,to=r.scheduleEndsLocal;
 const schedule=typeof weekday==="number"&&Number.isInteger(weekday)&&weekday>=1&&weekday<=7&&typeof from==="string"&&TIME.test(from)&&typeof to==="string"&&TIME.test(to)&&to>from?
  (weekday===7?"Chủ nhật":"Thứ "+(weekday+1))+" · "+from+"–"+to:null;
 const relations={studentId:id(r.studentProfileId),subscriptionId:id(r.subscriptionId),runningClassId:id(r.runningClassId)};
 return {row:{id:id(r.id),name:label(r.studentDisplayName),subscription:label(r.subscriptionDisplayName),runningClass:label(r.runningClassName),path:label(r.pathDisplayName),schedule,start,end,createdAt:stamp(r.createdAt),updatedAt:stamp(r.updatedAt),createdBy:null,updatedBy:null},relations};
}
export async function readEnrollmentRows(fetcher:typeof fetch,centerId:string,signal:AbortSignal):Promise<EnrollmentRead[]>{
 id(centerId);const rows:EnrollmentRead[]=[],seen=new Set<string>(),cursors=new Set<string>();let cursor:Cursor|null=null;
 for(let page=0;page<100;page++){
  signal.throwIfAborted();const q=new URLSearchParams({centerId,limit:"100"});
  if(cursor){q.set("beforeCreatedAt",cursor.createdAt);q.set("beforeSubscriptionId",cursor.id);}
  const response=await fetcher("/api/bo/school/enrollments?"+q,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal});
  if(!response.ok)throw new BoApiError(response.status,"Không thể tải lịch học được cấp quyền.",null);
  const data=object(object(await response.json()).data);
  if(!Array.isArray(data.items)||!Object.hasOwn(data,"nextCursor"))throw Error("Trang lịch học không hợp lệ.");
  for(const raw of data.items){const entry=project(raw);if(seen.has(entry.row.id))throw Error("Lịch học bị trùng.");seen.add(entry.row.id);rows.push(entry);if(rows.length>20000)throw Error("Danh sách lịch học vượt giới hạn đọc.");}
  if(data.nextCursor===null){signal.throwIfAborted();return rows;}
  const next=object(data.nextCursor),createdAt=stamp(next.createdAt);if(!createdAt)throw Error("Cursor lịch học thiếu ngày.");
  cursor={createdAt,id:id(next.id)};const key=JSON.stringify(cursor);if(cursors.has(key))throw Error("Cursor lịch học lặp.");cursors.add(key);
 }
 throw Error("Danh sách lịch học chưa được tải đầy đủ.");
}
export function enrollmentRelationLinks(relations:EnrollmentRelations,centerId:string){
 const center=id(centerId),detail=(module:string,record:string)=>"/bo?"+new URLSearchParams({module,centerId:center,record:id(record)});
 return [{label:"Học viên",href:detail("students",relations.studentId)},
  {label:"Subscription",href:"/bo?"+new URLSearchParams({module:"subscriptions",centerId:center,record:id(relations.subscriptionId)})},
  {label:"Lớp",href:detail("classes",relations.runningClassId)}];
}
