/** PAP-1495 / PAP-1491 S5: Founder metadata PUT with actual Core precheck and readback. */
import {BoApiError} from "./bo-api-error";
import {readSpecialtyV2Detail,parseSpecialtyDetail,type SpecialtyV2Detail} from "./ho-specialty-v2-reader";
import type {SpecialtyMetadataPatch} from "./ho-specialty-s5-metadata";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function putSpecialtyMetadataEdit(
 id:string,patch:SpecialtyMetadataPatch,fetcher:typeof fetch,signal:AbortSignal,key:string,
):Promise<SpecialtyV2Detail>{
 if(!uuid.test(id)||!key||!Number.isSafeInteger(patch.expectedVersion)||patch.expectedVersion<1)
  throw new BoApiError(400,"Lệnh chỉnh sửa Chuyên đề không hợp lệ.",null);
 const prior=await readSpecialtyV2Detail(id,fetcher,signal);
 if(prior.version!==patch.expectedVersion||prior.status!=="DRAFT")
  throw new BoApiError(409,"Chuyên đề đã thay đổi hoặc không còn là bản nháp.",null);
 const response=await fetcher("/api/ho/learning/specialties/"+id,{
  method:"PUT",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
  headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(patch),
 });
 signal.throwIfAborted();
 if(response.status!==200)throw new BoApiError(response.status,
  response.status===409?"Tên trùng hoặc dữ liệu đã thay đổi. Tải lại trước khi lưu.":
  response.status===401||response.status===403?"Bạn không có quyền sửa Chuyên đề.":"Không thể lưu Chuyên đề.",
  response.headers.get("x-request-id"));
 const body:unknown=await response.json();
 const dto=body&&typeof body==="object"&&"data" in body?
  parseSpecialtyDetail((body as {data:unknown}).data):null;
 if(!dto||dto.id!==id||dto.version!==patch.expectedVersion+1||dto.status!=="DRAFT")
  throw new BoApiError(502,"Không thể xác minh kết quả chỉnh sửa.",null);
 const verified=await readSpecialtyV2Detail(id,fetcher,signal);
 if(verified.version!==dto.version||verified.name!==dto.name||verified.description!==dto.description||
    ("name" in patch&&verified.name!==patch.name)||("description" in patch&&verified.description!==patch.description))
  throw new BoApiError(409,"Cần tải lại Chuyên đề để xác minh kết quả.",null);
 return verified;
}
