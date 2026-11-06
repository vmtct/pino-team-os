import {tosClassroomV18bApi,V18bCoreError} from "./tos-classroom-v18b-api";
import {classroomV4ReadModel} from "./tos-classroom-v4-view-model";
/** PAP-945: presentation uses HTTP status only; backend diagnostics must never become UI copy. */
export function classroomReadErrorMessage(status:unknown):string {
 switch(status){
  case 401:return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  case 403:return "Bạn chưa có quyền xem lớp học tại cơ sở này.";
  case 409:return "Thông tin lớp học đã thay đổi. Vui lòng tải lại.";
  default:return "Chưa thể tải lớp học. Vui lòng thử lại.";
 }
}
/** A successful but mismatched response must never be rendered as an authorized classroom. */
export async function loadClassroomV4(centerId:string,localDate:string,staffLabel:string){
 const day=await tosClassroomV18bApi.today(centerId,localDate);
 if(day.centerId!==centerId||day.localDate!==localDate||!Array.isArray(day.occurrences))throw new V18bCoreError(502,"CLASSROOM_SCOPE_RESPONSE_MISMATCH","Dữ liệu lớp học không khớp cơ sở hoặc ngày được chọn.");
 return classroomV4ReadModel(day,staffLabel);
}
