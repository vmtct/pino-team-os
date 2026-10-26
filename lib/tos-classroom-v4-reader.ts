import {tosClassroomV18bApi,V18bCoreError} from "./tos-classroom-v18b-api";
import {classroomV4ReadModel} from "./tos-classroom-v4-view-model";
/** A successful but mismatched response must never be rendered as an authorized classroom. */
export async function loadClassroomV4(centerId:string,localDate:string,staffLabel:string){
 const day=await tosClassroomV18bApi.today(centerId,localDate);
 if(day.centerId!==centerId||day.localDate!==localDate||!Array.isArray(day.occurrences))throw new V18bCoreError(502,"CLASSROOM_SCOPE_RESPONSE_MISMATCH","Dữ liệu lớp học không khớp cơ sở hoặc ngày được chọn.");
 return classroomV4ReadModel(day,staffLabel);
}
