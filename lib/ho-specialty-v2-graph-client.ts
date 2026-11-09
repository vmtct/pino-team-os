import {BoApiError} from "./bo-api-error";
import {readSpecialtyV2Detail,parseSpecialtyDetail,type SpecialtyV2Detail} from "./ho-specialty-v2-reader";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type SpecialtyGraphCommand=
 | {type:"SET_OVERVIEW";expectedVersion:number;levelCount:number;prerequisiteIds:string[];tags:string[]}
 | {type:"LINK_MISSION"|"UNLINK_MISSION";expectedVersion:number;levelId:string;missionId:string}
 | {type:"PUBLISH"|"UNPUBLISH"|"ARCHIVE"|"RESTORE";expectedVersion:number};
/** Read-before-write and Core readback after BFF CAS+audit, never invent success. */
export async function postSpecialtyGraphCommand(
 specialtyId:string,cmd:SpecialtyGraphCommand,fetcher:typeof fetch,signal:AbortSignal,key:string,
):Promise<SpecialtyV2Detail>{
 if(!uuid.test(specialtyId)||!key||!Number.isSafeInteger(cmd.expectedVersion)||cmd.expectedVersion<1)
  throw new BoApiError(400,"Lệnh Chuyên đề không hợp lệ.",null);
 const url="/api/ho/learning/specialties/"+specialtyId;
 const prior=await readSpecialtyV2Detail(specialtyId,fetcher,signal);
 const admissible=cmd.type==="RESTORE"?prior.status==="ARCHIVED":
  cmd.type==="UNPUBLISH"?prior.status==="ACTIVE":
  cmd.type==="ARCHIVE"?(prior.status==="DRAFT"||prior.status==="ACTIVE"):
  prior.status==="DRAFT";
 if(prior.version!==cmd.expectedVersion||!admissible)
  throw new BoApiError(409,"Chuyên đề đã thay đổi hoặc không còn ở trạng thái phù hợp.",null);
 const response=await fetcher(url+"/commands",{
  method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
  headers:{"content-type":"application/json","idempotency-key":key},
  body:JSON.stringify(cmd),
 });
 signal.throwIfAborted();
 if(response.status!==200)throw new BoApiError(response.status,
  response.status===409?(cmd.type==="ARCHIVE"?"Core từ chối lưu trữ: quyền học hoặc tiên quyết chưa được xác minh an toàn.":
   "Dữ liệu đã thay đổi. Tải lại trước khi lưu."):
  response.status===401||response.status===403?"Bạn không có quyền sửa Chuyên đề.":
  "Không thể lưu thay đổi Chuyên đề.",response.headers.get("x-request-id"));
 const envelope:unknown=await response.json();
 const dto=typeof envelope==="object"&&envelope!==null&&"data" in envelope?
  parseSpecialtyDetail((envelope as {data:unknown}).data):null;
 const expectedStatus=cmd.type==="PUBLISH"?"ACTIVE":cmd.type==="ARCHIVE"?"ARCHIVED":"DRAFT";
 if(!dto||dto.id!==specialtyId||dto.version!==cmd.expectedVersion+1||dto.status!==expectedStatus)
  throw new BoApiError(502,"Không thể xác minh kết quả chỉnh sửa.",null);
 const verified=await readSpecialtyV2Detail(specialtyId,fetcher,signal);
 if(verified.version!==dto.version||verified.status!==dto.status||JSON.stringify(verified.levels)!==JSON.stringify(dto.levels)||
    JSON.stringify(verified.tags)!==JSON.stringify(dto.tags)||
    JSON.stringify(verified.prerequisiteIds)!==JSON.stringify(dto.prerequisiteIds))
  throw new BoApiError(409,"Đã lưu nhưng cần tải lại Chuyên đề để xác minh.",null);
 return verified;
}
