/** PAP-945 — reload reconciliation by an existing, known Diary ID.
 * Read-only: no POST, no idempotency key replacement, no locally stored student PII.
 * An unverified/unknown id or incomplete Draft can never be used to re-Register.
 */
import {V18bCoreError,type V18bPathDiary,type V18bDiaryMissionLink,type createV18bApiTransport} from "./tos-classroom-v18b-api";
type Client=Pick<ReturnType<typeof createV18bApiTransport>,"eligibleMissions"|"diary"|"missionLinks">;
export type ReloadScope={centerId:string;runningClassId:string;studentId:string;localDate:string;teachingContextKey:string;diaryId:string;selectedMissionIds:readonly string[]};
export type ReloadReceipt={
 state:"SOURCE_UNVERIFIED"|"OBSERVATION_UNVERIFIED"|"LINK_PENDING_READONLY"|"LINK_VERIFIED_READONLY";
 diaryId:string|null;verifiedMissionIds:string[];pendingMissionIds:string[];
 message:string;canCreate:boolean;canRetry:boolean;
};
const result=(state:ReloadReceipt["state"],diaryId:string|null,verified:string[],pending:string[],message:string):ReloadReceipt=>({
 state,diaryId,verifiedMissionIds:verified,pendingMissionIds:pending,message,canCreate:false,canRetry:false,
});
const uncertain=(message:string)=>result("SOURCE_UNVERIFIED",null,[],[],message);
const valid=(v:unknown)=>typeof v==="string"&&v.trim().length>0&&v.length<=160;
function checkDiary(d:V18bPathDiary,s:ReloadScope,pathKey:string):boolean{
 return Boolean(d&&d.id===s.diaryId&&d.centerId===s.centerId&&
 d.studentId===s.studentId&&d.teachingContextKey===s.teachingContextKey&&
 d.pathKey===pathKey&&["REGISTERED","CLOSED"].includes(d.status)&&
 Number.isSafeInteger(d.version)&&d.version>0);
}
function hasObservation(d:V18bPathDiary):boolean {
 return Boolean((d.draftSavedAt||d.closedAt)&&typeof d.notes==="string"&&d.notes.trim().length>0&&
 Number.isInteger(d.interest)&&d.interest!==null&&d.interest>=1&&d.interest<=4&&
 (d.interest!==1||(typeof d.difficulty==="string"&&d.difficulty.trim().length>0)));
}
/** Source-only recovery inspection. Reads current scoped Mission eligibility, Diary and links;
 * fails closed on cross-Center/Student/Path/context/Assignment, stale/partial catalog or any 401/403/404/409/503.
 * The returned state is for display ONLY. It must never enable Create or Retry.
 */
export async function inspectDiaryAfterReload(client:Client,s:ReloadScope):Promise<ReloadReceipt>{
 if(!valid(s?.centerId)||!valid(s?.runningClassId)||!valid(s?.studentId)||!valid(s?.diaryId)||
 !valid(s?.localDate)||!valid(s?.teachingContextKey)||
 s.teachingContextKey!==s.runningClassId+":"+s.localDate||
 !Array.isArray(s.selectedMissionIds)||s.selectedMissionIds.length===0||
 s.selectedMissionIds.some(m=>!valid(m))||new Set(s.selectedMissionIds).size!==s.selectedMissionIds.length)
 return uncertain("Thông tin Diary, lớp hoặc Mission chưa hợp lệ. Không thể tự động tạo lại.");
 try{
  const eligible=await client.eligibleMissions({
   centerId:s.centerId,runningClassId:s.runningClassId,studentId:s.studentId,
   localDate:s.localDate,teachingContextKey:s.teachingContextKey,
  });
  if(eligible.hasMore||eligible.centerId!==s.centerId||eligible.runningClassId!==s.runningClassId||
  eligible.studentId!==s.studentId||eligible.localDate!==s.localDate||
  eligible.teachingContextKey!==s.teachingContextKey||!valid(eligible.pathProgramId)||
  !Array.isArray(eligible.items)||s.selectedMissionIds.some(m=>!eligible.items.some(x=>x.missionId===m)))
  return uncertain("Mission hoặc phạm vi lớp không khớp dữ liệu Core. Không retry.");
  const diary=await client.diary(s.diaryId,s.centerId);
  if(!checkDiary(diary,s,eligible.pathProgramId))
   return uncertain("Core không xác nhận đúng Center, học viên, Path hoặc Diary ID. Không retry.");
  if(!hasObservation(diary))
   return result("OBSERVATION_UNVERIFIED",s.diaryId,[],[...s.selectedMissionIds],
    "Core tìm thấy Diary, nhưng ghi chú chưa được xác nhận. Cần đối soát bản ghi gốc trước khi thao tác.");
  const links=await client.missionLinks(s.diaryId,s.centerId);
  if(!Array.isArray(links)||links.some(x=>x.diaryId!==s.diaryId||!valid(x.missionId))||
     new Set(links.map(x=>x.missionId)).size!==links.length)
   return uncertain("Core trả liên kết Mission không đồng nhất với Diary ID.");
  const verified:string[]=[];
  for(const id of s.selectedMissionIds){
   const choice=eligible.items.find(x=>x.missionId===id);
   const row:V18bDiaryMissionLink|undefined=links.find(x=>x.missionId===id);
   if(row&&row.assignmentId!==choice?.assignmentId)
    return uncertain("Assignment của Mission không khớp nguồn Core. Không retry.");
   if(row)verified.push(id);
  }
  const pending=s.selectedMissionIds.filter(id=>!verified.includes(id));
  if(pending.length)return result("LINK_PENDING_READONLY",s.diaryId,verified,pending,
   "Ghi chú đã được Core xác nhận, nhưng liên kết Mission chưa đủ. Đây chỉ là đối soát read-only.");
  return result("LINK_VERIFIED_READONLY",s.diaryId,verified,[],
   "Đã đọc lại đúng Diary, ghi chú và liên kết Mission từ Core. Không phát sinh lệnh ghi.");
 }catch(e){
  const status=e instanceof V18bCoreError?e.status:null;
  const safe=[401,403,404,409,503].includes(status??0)?"Core chưa cho phép xác minh bản ghi này. ":"Không thể xác minh an toàn từ Core. ";
  return uncertain(safe+"Không retry hoặc tạo Diary thứ hai.");
 }
}
