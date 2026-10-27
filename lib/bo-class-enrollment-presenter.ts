/** PAP-1041 — shared BO presentation of canonical Enrollment date semantics. */
export interface ClassEnrollmentDates {
  effectiveFromLocalDate:string;
  effectiveUntilExclusiveLocalDate:string|null;
}
export function validLocalDate(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const day=new Date(value+"T12:00:00.000Z");
  return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value;
}
export function displayLocalDate(value:string|null):string{
  if(!value||!validLocalDate(value))return "—";
  return new Intl.DateTimeFormat("vi-VN",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value+"T12:00:00.000Z"));
}
export function enrollmentDisplayEndDate(untilExclusive:string|null):string{
  if(untilExclusive===null)return "—";
  if(!validLocalDate(untilExclusive))return "—";
  const date=new Date(untilExclusive+"T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate()-1);
  return displayLocalDate(date.toISOString().slice(0,10));
}
export function centerBusinessDate(timeZone:string|null,now:Date=new Date()):string|null{
  if(!timeZone)return null;
  try{
    const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const v=(name:string)=>parts.find(part=>part.type===name)?.value??"";
    const value=[v("year"),v("month"),v("day")].join("-");
    return validLocalDate(value)?value:null;
  }catch{return null;}
}
export function enrollmentPeriodState(item:ClassEnrollmentDates,today:string|null):
{label:"Đang học"|"Sắp bắt đầu"|"Đã kết thúc"|"Chưa xác định";priority:number}{
  if(!today||!validLocalDate(today)||!validLocalDate(item.effectiveFromLocalDate))return {label:"Chưa xác định",priority:3};
  if(item.effectiveFromLocalDate>today)return {label:"Sắp bắt đầu",priority:1};
  if(item.effectiveUntilExclusiveLocalDate!==null){
    if(!validLocalDate(item.effectiveUntilExclusiveLocalDate))return {label:"Chưa xác định",priority:3};
    if(item.effectiveUntilExclusiveLocalDate<=today)return {label:"Đã kết thúc",priority:2};
  }
  return {label:"Đang học",priority:0};
}
