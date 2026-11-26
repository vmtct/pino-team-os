// PAP-2358 · WFM-STAFF. Presentation only; canonical timestamps stay in provider.
import type {OverviewProperties} from "@/app/components/workspace-renderer/Properties";
const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
export function formatStaffAuditTime(value:unknown):string{
  if(typeof value!=="string"||!Number.isFinite(Date.parse(value)))return "—";
  const parts=Object.fromEntries(time.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  return parts.day+"/"+parts.month+"/"+parts.year+" · "+parts.hour+":"+parts.minute;
}
export function staffNativeOverviewProperties(properties:OverviewProperties):OverviewProperties{
  const {record}=properties;
  const birth=typeof record.birthDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(record.birthDate)?record.birthDate.split("-").reverse().join("/"):"—";
  return {...properties,record:{...record,birthDate:birth,createdAt:formatStaffAuditTime(record.createdAt),updatedAt:formatStaffAuditTime(record.updatedAt)}};
}
