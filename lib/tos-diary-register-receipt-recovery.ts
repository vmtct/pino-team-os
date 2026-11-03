/** PAP-1400 / platform Epic PAP-938, feature Epic PAP-727.
 * Read-only lost-ACK lookup for the EXACT original Diary Register command.
 *
 * Unlike Register replay this helper never submits a Diary, Draft, Link, Evidence
 * or MissionResult command. POST /register-receipt is a source-side READ lookup
 * with the original Register body and Idempotency-Key, not a creation request.
 * The browser must supply the *original* submission key; do not synthesize a
 * replacement or infer the student from unrelated records after a reload.
 */
import {V18bCoreError,type createV18bApiTransport} from "./tos-classroom-v18b-api";
import {inspectDiaryAfterReload,type ReloadReceipt} from "./tos-diary-reload-inspection";

type Client=Pick<ReturnType<typeof createV18bApiTransport>,
 "registerReceipt"|"eligibleMissions"|"diary"|"missionLinks">;
type RegisterBody=Parameters<Client["registerReceipt"]>[0];

export type OriginalRegisterProof={
 registration:RegisterBody;
 /** Same opaque submissionKey used by the original PAP-945 Register POST. */
 submissionKey:string;
 localDate:string;
 /** Explicitly reselected from a fresh authorized Core Mission catalog. */
 selectedMissionIds:readonly string[];
};

export type LostAckResult={
 state:"RECEIPT_FOUND_READONLY"|"RECEIPT_FOUND_INCOMPLETE"|
  "RECEIPT_UNSEEN"|"RECEIPT_DENIED"|"RECEIPT_CONFLICT"|"RECEIPT_UNVERIFIED";
 diaryId:string|null;
 /** Never an authorization, create/retry permit, or positive business E2E receipt. */
 canCreate:false;
 canRetry:false;
 message:string;
 inspection:ReloadReceipt|null;
};

function result(state:LostAckResult["state"],message:string,
 diaryId:string|null=null,inspection:ReloadReceipt|null=null):LostAckResult{
 return {state,message,diaryId,inspection,canCreate:false,canRetry:false};
}
function string(v:unknown){return typeof v==="string"&&v.trim().length>0&&v.length<=160;}

function validProof(p:OriginalRegisterProof):boolean{
 const r=p?.registration;
 return Boolean(r&&string(r.centerId)&&string(r.runningClassId)&&string(r.studentId)&&
  string(r.pathKey)&&string(r.teachingContextKey)&&string(p.submissionKey)&&
  typeof p.localDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(p.localDate)&&
  !Number.isNaN(Date.parse(p.localDate+"T12:00:00Z"))&&
  new Date(p.localDate+"T12:00:00Z").toISOString().slice(0,10)===p.localDate&&
  r.teachingContextKey===r.runningClassId+":"+p.localDate&&
  Array.isArray(p.selectedMissionIds)&&p.selectedMissionIds.length>0&&
  p.selectedMissionIds.every(string)&&
  new Set(p.selectedMissionIds).size===p.selectedMissionIds.length);
}

/** Safe even when the mutation adapter is disabled.
 * 404/UNSEEN means STOP, never an instruction to post Register.
 * Found source receipt permits only subsequent read-back of the original Diary.
 */
export async function reconcileUnknownDiaryRegister(
 client:Client,original:OriginalRegisterProof,
):Promise<LostAckResult>{
 if(!validProof(original))
  return result("RECEIPT_UNVERIFIED",
   "Thiếu khóa gửi gốc hoặc phạm vi lớp/học viên/Mission; không tạo lại Nhật ký.");
 const r=original.registration;
 let diaryId:string;
 try{
  const diary=await client.registerReceipt(r,"pap945:"+original.submissionKey+":register");
  if(!diary||!string(diary.id)||diary.centerId!==r.centerId||
   diary.studentId!==r.studentId||diary.runningClassId!==r.runningClassId||
   diary.pathKey!==r.pathKey||diary.teachingContextKey!==r.teachingContextKey)
   return result("RECEIPT_UNVERIFIED",
    "Biên nhận không khớp nguồn Core; không tạo lại Nhật ký.");
  diaryId=diary.id;
 }catch(error){
  const code=error instanceof V18bCoreError?error.status:0;
  if(code===404)
   return result("RECEIPT_UNSEEN",
    "Core không tìm thấy biên nhận gửi gốc. Không được tự gửi lại Register.");
  if(code===401||code===403)
   return result("RECEIPT_DENIED",
    "Phiên làm việc không có quyền đối soát biên nhận này.");
  if(code===409)
   return result("RECEIPT_CONFLICT",
    "Khóa gửi và dữ liệu Register gốc không khớp. Không retry.");
  return result("RECEIPT_UNVERIFIED",
   "Không xác nhận được biên nhận Core; không gửi lại để tránh tạo bản ghi trùng.");
 }
 const inspection=await inspectDiaryAfterReload(client,{
  centerId:r.centerId,runningClassId:r.runningClassId,studentId:r.studentId,
  localDate:original.localDate,teachingContextKey:r.teachingContextKey,
  diaryId,selectedMissionIds:original.selectedMissionIds,
 });
 if(inspection.state!=="LINK_VERIFIED_READONLY")
  return result("RECEIPT_FOUND_INCOMPLETE",
   "Đã tìm thấy Diary ID gốc nhưng ghi chú hoặc Mission chưa đủ bằng chứng. Chỉ đọc.",
   diaryId,inspection);
 return result("RECEIPT_FOUND_READONLY",
  "Đã xác nhận cùng Diary ID, ghi chú và Mission từ Core. Không phát sinh ghi mới.",
  diaryId,inspection);
}
