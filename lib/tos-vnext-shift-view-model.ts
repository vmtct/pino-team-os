import type {Assignment} from "./workforce-api";
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
export function formatIncome(minor:number|null|undefined){return minor==null?"—":new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(minor/100)}
export function shiftRoleLabel(row:Assignment){
 const labels={FRONT_DESK:"Tiếp tân",TEACHER:"Giáo viên",TEACHING_ASSISTANT:"Trợ giảng",SHIFT_LEADER:"Trưởng ca"} as const;
 return [...new Set(row.roleAssignments?.map(role=>labels[role.roleType])??[])].join(" · ")||"Chưa có vai trò được phân công";
}
