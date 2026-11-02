/** PAP-945 / PAP-727: truthful TOS receipt display; never a source of authority. 
 * Fail-closed client operations: a pending or ambiguous Register cannot create a second Diary.
 */
import type {ObservationOutcome} from "./tos-diary-observation-workflow";

export type DiaryUiReceipt={
 state:ObservationOutcome["state"];
 severity:"success"|"warning";
 title:string;message:string;diaryId:string|null;
 canRetry:boolean;pendingMissionIds:string[];
};
export function diaryUiReceipt(outcome:ObservationOutcome|null):DiaryUiReceipt|null{
 if(!outcome)return null;
 if(outcome.state==="REGISTER_UNCERTAIN")return {
  state:outcome.state,severity:"warning",title:"Chưa xác nhận tạo Nhật ký",
  message:"Core chưa trả ID. Không được gửi lại để tránh tạo trùng. Cần đối soát từ nguồn Core.",
  diaryId:null,canRetry:false,pendingMissionIds:[],
 };
 if(outcome.state==="OBSERVATION_PENDING")return {
  state:outcome.state,severity:"warning",title:"Ghi chú đang chờ xác nhận",
  message:"Nhật ký đã có ID nhưng Core chưa xác nhận đầy đủ ghi chú. Chỉ thử lại sau khi đọc lại đúng bản ghi.",
  diaryId:outcome.plan.diaryId,canRetry:true,pendingMissionIds:[],
 };
 if(outcome.state==="LINK_PENDING")return {
  state:outcome.state,severity:"warning",title:"Đang chờ liên kết Nhiệm vụ",
  message:"Ghi chú đã được xác nhận; liên kết Mission chưa đủ. Retry trên cùng Diary, không tạo mới.",
  diaryId:outcome.plan.diaryId,canRetry:true,pendingMissionIds:outcome.pendingMissionIds,
 };
 return {
  state:"LINK_VERIFIED",severity:"success",title:"Đã xác minh Nhật ký và Nhiệm vụ",
  message:"Core đã xác nhận ghi chú và đọc lại đủ liên kết Mission trên cùng Diary.",
  diaryId:outcome.plan.diaryId,canRetry:false,pendingMissionIds:[],
 };
}
export function canCreateDiary(outcome:ObservationOutcome|null,writeAdmitted:boolean):boolean{
 return writeAdmitted&&outcome===null;
}
export function canRetryDiary(outcome:ObservationOutcome|null,writeAdmitted:boolean):boolean{
 return writeAdmitted&&Boolean(diaryUiReceipt(outcome)?.canRetry);
}
