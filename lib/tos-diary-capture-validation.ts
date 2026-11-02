/** PAP-945: lightweight Diary observation form validation, not Core authorization.
 * Completion of MissionResult is deliberately independent of Diary save.
 */
export interface DiaryCaptureInput{
 studentId:string;missionIds:readonly string[];eligibleIds:readonly string[];
 eligibilityLoaded:boolean;eligibilityHasMore:boolean;
 notes:string;interest:number|null;difficulty:string;
}
export function validateDiaryCaptureDraft(input:DiaryCaptureInput):string[]{
 const errors:string[]=[];
 if(!input.studentId.trim())errors.push("Cần chọn học viên thuộc roster.");
 if(!input.eligibilityLoaded||input.eligibilityHasMore)
  errors.push("Chưa xác nhận đầy đủ Mission từ Core.");
 if(!input.missionIds.length)errors.push("Cần chọn ít nhất một Nhiệm vụ.");
 if(new Set(input.missionIds).size!==input.missionIds.length||
    input.missionIds.some(id=>!input.eligibleIds.includes(id)))
  errors.push("Nhiệm vụ không thuộc danh sách hợp lệ.");
 if(!input.notes.trim())errors.push("Cần nhập ghi chú quan sát.");
 if(input.interest===null||!Number.isInteger(input.interest)||input.interest<1||input.interest>4)
  errors.push("Cần chọn mức hứng thú 1–4.");
 if(input.interest===1&&!input.difficulty.trim())
  errors.push("Cần mô tả khó khăn khi học viên phản kháng.");
 return errors;
}
