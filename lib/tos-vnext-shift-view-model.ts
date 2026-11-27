import {formatPayrollVnd,type OwnIncomePeriod} from "./tos-own-income-api";
import type {Assignment,TimekeepingSession} from "./workforce-api";
/** PAP-2429: actual timekeeping duration, never substituted with payable payroll minutes. */
export function effectiveHistorySeconds(row:TimekeepingSession):number|null{
 const seconds=row.effective?.durationSeconds;
 return row.status==="CLOSED"&&typeof seconds==="number"&&Number.isFinite(seconds)&&seconds>0?seconds:null;
}
export function monthToDateHistory(rows:TimekeepingSession[]|null,localDate:string){
 if(rows===null)return {rows:null,seconds:null};
 const selected=rows.filter(row=>row.workDate>=localDate.slice(0,8)+"01"&&row.workDate<=localDate);
 const durations=selected.map(effectiveHistorySeconds);
 return {rows:selected,seconds:durations.some(value=>value===null)?null:durations.reduce<number>((total,value)=>total+(value??0),0)};
}
export function formatHistoryHours(seconds:number|null){
 return seconds===null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:2}).format(seconds/3600)+" giờ";
}
/** Calendar-only arithmetic; localDate has already been resolved in the authorized center's timezone. */
export function shiftWeek(localDate:string){
 const date=new Date(localDate+"T12:00:00Z");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==localDate)throw new Error("Invalid center date");
 date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 return Array.from({length:7},(_,i)=>{const day=new Date(date);day.setUTCDate(day.getUTCDate()+i);return {date:day.toISOString().slice(0,10),label:["T2","T3","T4","T5","T6","T7","CN"][i]}});
}
export function shiftWeekOffset(localDate:string,weeks:number){
 shiftWeek(localDate); // Validate the input before deriving an adjacent local calendar date.
 if(!Number.isInteger(weeks)||Math.abs(weeks)>52)throw new Error("Invalid week offset");
 const date=new Date(localDate+"T12:00:00Z");
 date.setUTCDate(date.getUTCDate()+weeks*7);
 return date.toISOString().slice(0,10);
}
export function activeScheduleAssignments(rows:Assignment[],selectedDate:string){
 return rows.filter(row=>row.workDate===selectedDate&&row.status==="ACTIVE");
}
export function assignmentHours(row:Assignment){
 const clock=(value:string|null|undefined)=>{if(!value)return null;const match=value.match(/(?:T|^)(\d{2}:\d{2})(?::\d{2})?/);return match?.[1]??null};
 const start=clock(row.effectiveStartLocal??row.shift?.startLocalTime),end=clock(row.effectiveEndLocal??row.shift?.endLocalTime);
 return start&&end?`${start}–${end}`:"Chưa xác định giờ ca";
}
export function formatIncome(minor:number|null|undefined){return formatPayrollVnd(minor)}
/** PAP-2429: present the existing Core period breakdown without deriving or fabricating amounts. */
export function incomeBreakdown(period:OwnIncomePeriod|undefined){
 return [
  ["Tiền công cơ bản",period?.standardMinor],
  ["Làm thêm giờ",period?.extraTimeMinor],
  ["Điều chỉnh",period?.adjustmentsMinor],
 ] as const;
}
export function shiftRoleLabel(row:Assignment){
 const labels={FRONT_DESK:"Tiếp tân",TEACHER:"Giáo viên",TEACHING_ASSISTANT:"Trợ giảng",SHIFT_LEADER:"Trưởng ca"} as const;
 return [...new Set(row.roleAssignments?.map(role=>labels[role.roleType])??[])].join(" · ")||"Chưa có vai trò được phân công";
}
