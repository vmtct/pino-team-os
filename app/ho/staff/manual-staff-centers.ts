// PAP-2358 · WFM-STAFF. Existing authorized Center directory; no inferred grants.
import type {StaffCenterOption} from "./manual-create-contract";
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function invalid():never{throw Error("Danh mục cơ sở không hợp lệ.");}
export function projectManualStaffCenters(raw:unknown):StaffCenterOption[]{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||!("data" in raw)||!Array.isArray(raw.data)||raw.data.length>500)invalid();
 const seen=new Set<string>(),result:StaffCenterOption[]=[];
 for(const entry of raw.data){
  if(!entry||typeof entry!=="object"||Array.isArray(entry))invalid();
  const row=entry as Record<string,unknown>,{id,displayName,status}=row;
  if(typeof id!=="string"||!idPattern.test(id)||seen.has(id)||typeof displayName!=="string"||!displayName.trim()||
     (status!=="active"&&status!=="inactive"))invalid();
  seen.add(id);
  if(status==="active")result.push({id,label:displayName.trim()});
 }
 return result;
}
export async function readManualStaffCenters(fetcher:typeof fetch=fetch,signal?:AbortSignal):Promise<StaffCenterOption[]>{
 const response=await fetcher("/api/bo/centers",{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",...(signal?{signal}:{})});
 signal?.throwIfAborted();
 if(!response.ok)throw Error("Không tải được danh sách cơ sở.");
 const raw:unknown=await response.json();signal?.throwIfAborted();
 return projectManualStaffCenters(raw);
}
