import {tosLearningApi} from "./tos-learning-api";
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
 const model=classroomV4ReadModel(day,staffLabel);
 model.diaryOccurrenceReadState={};
 const loadPaths=async()=>{
  if(!model.classes.length)return;
  const {data}=await tosLearningApi.sessionsDay(centerId,localDate);
  if(data.centerId!==centerId||data.localDate!==localDate||!Array.isArray(data.sessions))return;
  for(const classroom of model.classes){
   const labels=new Set(data.sessions.filter(session=>session.runningClassId===classroom.runningClassId&&session.pathProgramId===classroom.pathProgramId&&session.localDate===localDate).map(session=>typeof session.pathDisplayName==="string"?session.pathDisplayName.trim():"").filter(Boolean));
   if(labels.size===1)classroom.path=[...labels][0]!;
  }
 };
 await Promise.all([loadPaths().catch(()=>{}),...day.occurrences.map(async row=>{
  const teachingContextKey=row.teachingContextKey;
  try{
   const read=await tosClassroomV18bApi.diariesForOccurrence({centerId,localDate,
    runningClassId:row.runningClassId,pathKey:row.occurrence.pathProgramId});
   if(read.centerId!==centerId||read.localDate!==localDate||read.teachingContextKey!==teachingContextKey||
    !Array.isArray(read.diaries))throw new Error("Diary occurrence mismatch");
   const members=new Set(row.roster.map(student=>student.studentProfileId));
   const entries=await Promise.all(read.diaries.map(async diary=>{
    if(!members.has(diary.studentId)||diary.centerId!==centerId||diary.teachingContextKey!==teachingContextKey||
     diary.pathKey!==row.occurrence.pathProgramId||diary.runningClassId!==row.runningClassId||
     !diary.registeredAt||!["REGISTERED","CLOSED"].includes(diary.status))throw new Error("Diary scope mismatch");
    const links=await tosClassroomV18bApi.missionLinks(diary.id,centerId);
    if(!Array.isArray(links)||links.some(link=>link.diaryId!==diary.id))throw new Error("Diary link mismatch");
    return {id:diary.id,studentId:diary.studentId,teachingContextKey,path:"?",status:diary.status,
     notes:diary.notes??"",interest:diary.interest,difficulty:diary.difficulty??undefined,
     at:diary.registeredAt,registeredBy:"Nh?n s?",draftSavedAt:diary.draftSavedAt??undefined,
     closedAt:diary.closedAt??undefined,version:diary.version,missionChanges:[],mediaNames:[],
     link:links.length?"VERIFIED" as const:"PENDING" as const,
     missions:links.map(link=>({id:link.missionCode,name:link.missionName,completed:null,
      assignedAt:link.linkedAt,assignedBy:"Nh?n s?"}))};
   }));
   model.data.diaries.push(...entries);
   model.diaryOccurrenceReadState![teachingContextKey]="LOADED";
  }catch{
   model.diaryOccurrenceReadState![teachingContextKey]="UNAVAILABLE";
  }
 })]);
 return model;
}
