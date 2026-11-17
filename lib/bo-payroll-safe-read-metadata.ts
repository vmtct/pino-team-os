/** PAP-1959: display only the authorized server's verified-name projection. */
export function payrollVerifiedName(value:unknown):string {
 const name=typeof value==="string"?value.trim():"";
 return name.length>0&&name.length<=160?name:"—";
}
export function payrollAuditTime(value:unknown):string {
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return "—";
 const at=Date.parse(value);
 if(!Number.isFinite(at))return "—";
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(at));
 const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
 return get("day")+"/"+get("month")+"/"+get("year")+" · "+get("hour")+":"+get("minute");
}
