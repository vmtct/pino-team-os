// PAP-1847 / Epic PAP-1705 PNR-AVATAR-CRUD — typed BO Nickname CAS and independent Core GET readback.
import {BoApiError} from "@/lib/bo-api-error";
import type {BoValue} from "@/lib/bo-registration";
import {loadAvatarPage, type AvatarRow} from "./avatar-dsa-data";

const UUID_V7=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function canEditNickname(row:AvatarRow,grants:ReadonlySet<string>):boolean {
 return grants.has("pinoria.self.nickname.manage") && row.selfStatus==="ACTIVE" &&
   typeof row.pinoriaSelfId==="string" && UUID_V7.test(row.pinoriaSelfId) &&
   Number.isSafeInteger(row.selfVersion) && Number(row.selfVersion)>0;
}
export function nicknameInput(value:BoValue):string|null {
 if(typeof value!=="string")throw new BoApiError(400,"Nickname không hợp lệ.",null);
 const trimmed=value.normalize("NFC").trim();
 if(!trimmed)return null; // Explicit empty input + Save means clear.
 if([...trimmed].length>40 || /[\u0000-\u001f\u007f-\u009f]/u.test(trimmed))
  throw new BoApiError(400,"Nickname tối đa 40 ký tự hợp lệ.",null);
 return trimmed;
}
export async function patchAvatarNickname(centerId:string,row:AvatarRow,nickname:string|null,signal:AbortSignal):Promise<void> {
 if(!UUID_V7.test(centerId) || typeof row.pinoriaSelfId!=="string" || !UUID_V7.test(row.pinoriaSelfId)
   || !Number.isSafeInteger(row.selfVersion) || Number(row.selfVersion)<1 || row.selfStatus!=="ACTIVE")
   throw new BoApiError(400,"Không thể sửa Nickname khi thiếu quyền hoặc phiên bản Core.",null);
 const response=await fetch("/api/bo/pinoria/avatars/"+encodeURIComponent(row.pinoriaSelfId)+"?"+
   new URLSearchParams({centerId}),{
   method:"PATCH",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
   headers:{"content-type":"application/json"},
   body:JSON.stringify({nickname,expectedSelfVersion:row.selfVersion})
 });
 if(!response.ok){
  const message=response.status===409?"Nickname đã thay đổi ở phiên khác. Đang tải lại dữ liệu.":
   response.status===401?"Phiên đăng nhập đã hết hạn.":
   response.status===403?"Không có quyền sửa Nickname tại Center này.":
   response.status===404?"Avatar không còn thuộc Center được chọn.":
   "Không thể cập nhật Nickname.";
  throw new BoApiError(response.status,message,response.headers.get("x-request-id"));
 }
 if(response.status!==200)throw new BoApiError(502,"Core không xác nhận cập nhật Nickname.",null);
}
/** Read actual Core again after success/409. Never synthesize a newer version or audit. */
export async function reloadAvatarAfterNickname(centerId:string,previous:AvatarRow,signal:AbortSignal):Promise<AvatarRow> {
 if(!UUID_V7.test(centerId)||!previous.id)throw new BoApiError(400,"Center/Avatar không hợp lệ.",null);
 // Search by immutable display name first; bound every page and never trust fuzzy identity matching.
 for(const search of [String(previous.name), ""]){
  let cursor:string|null=null;
  const seen=new Set<string>();
  for(let i=0;i<20;i++){
   const page=await loadAvatarPage(centerId,{limit:100,search,rules:[],cursor},signal);
   const row=page.records.find(r=>r.id===previous.id);
   if(row){
    if(row.pinoriaSelfId!==previous.pinoriaSelfId || row.selfStatus!=="ACTIVE" ||
       !Number.isSafeInteger(row.selfVersion)||Number(row.selfVersion)<1)
      throw new BoApiError(409,"Phiên bản Avatar đã thay đổi hoặc không còn hiệu lực.",null);
    return row;
   }
   if(!page.nextCursor||seen.has(page.nextCursor))break;
   seen.add(page.nextCursor);cursor=page.nextCursor;
  }
 }
 throw new BoApiError(404,"Core không còn trả về Avatar này tại Center đã chọn.",null);
}
