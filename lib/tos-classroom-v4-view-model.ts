/** PAP-945 presentation DTOs. They do not define Core authorization or business transitions. */
import type {V18bClassroomToday} from "./tos-classroom-v18b-api";
export type ReviewStatus="PENDING"|"APPROVED"|"REJECTED";
export type OpeningPhoto={id:string;fileName:string;preview:string;uploadedAt:string;uploadedBy:string};
export type OpeningRound={id:string;submittedAt:string;submittedBy:string;note:string;photos:OpeningPhoto[];status:ReviewStatus;reviewedAt?:string;reviewedBy?:string;reason?:string};
export type OpeningRecord={openedAt:string;openedBy:string;image:string;fileName:string;version:number;rounds?:OpeningRound[]};
export type Tab="students"|"missions"|"diaries";
export type Domain="art"|"piano"|"unknown";
export type Gender="Nữ"|"Nam"|"Khác / chưa cung cấp";
export type State="REGISTERED"|"CLOSED";
export type Student={id:string;name:string;age:number|null;gender:Gender;domain:Domain;path:string;lead?:boolean};
export type ScheduledClass={id:string;name:string;subject:Domain;path:string;time:string;room:string;staff:string[];expected:string[]};

export type Mission={id:string;name:string;subject:Domain;path:string;level:number;description:string;guideline:string[];materials:string;prerequisites:string[];plsValue?:number};
export type Evidence={name:string;kind:"image"|"video";preview?:string};
export type DiaryMission={id:string;name:string;completed:null|boolean;assignedAt:string;assignedBy:string;continuedFromDiaryId?:string;resultSavedAt?:string;resultSavedBy?:string};
export type DiaryMissionChange={fromId:string;toId:string;changedAt:string;changedBy:string};
export type Diary={id:string;studentId:string;teachingContextKey:string;path:string;missions:DiaryMission[];missionChanges:DiaryMissionChange[];status:State;interest:null|number;notes:string;difficulty?:string;at:string;registeredBy:string;draftSavedAt?:string;draftSavedBy?:string;closedAt?:string;closedBy?:string;version:number;link:"PENDING"|"VERIFIED";mediaNames:string[];media?:Evidence[]};
export type Data={students:Student[];participants:Record<string,string[]>;openings:Record<string,OpeningRecord>;diaries:Diary[];sequence:number};

export type CollectionReadState="LOADED"|"UNAVAILABLE";
export interface ClassroomV4ViewModel {
 today:string;staffLabel:string;classes:ScheduledClass[];data:Data;missions:Mission[];
 diaryReadState:CollectionReadState;missionReadState:CollectionReadState;openingReadState:CollectionReadState;
 conflictStudentIds:string[];
}
export interface ClassroomV4InitialView {classId?:string;tab?:Tab;overlay?:"student"|"historyDetail"|"add"|"assign"|"guide"|"diary"|"photo";studentId?:string;diaryId?:string;missionId?:string;openingClassId?:string}
export function evidenceRounds(opening?:OpeningRecord):OpeningRound[]{return opening?.rounds??[]}
export function lastRound(opening?:OpeningRecord){return evidenceRounds(opening).at(-1)}
export function reviewState(opening?:OpeningRecord){return lastRound(opening)?.status}
export function reviewText(status?:ReviewStatus){return status==="REJECTED"?"Không được duyệt":status==="APPROVED"?"Đã duyệt":"Chưa xác minh"}
export function needsAction(opening?:OpeningRecord){return reviewState(opening)==="REJECTED"}
export function classroomV4ReadModel(day:V18bClassroomToday,staffLabel:string):ClassroomV4ViewModel {
 const students=new Map<string,Student>(),participants:Record<string,string[]>={},conflicts=new Set<string>();
 const classes=day.occurrences.map(row=>{
  participants[row.teachingContextKey]=row.roster.map(member=>{
   if(!students.has(member.studentProfileId))students.set(member.studentProfileId,{id:member.studentProfileId,name:member.studentDisplayName,age:null,gender:"Khác / chưa cung cấp",domain:"unknown",path:"—"});
   if(member.status==="CONFLICT")conflicts.add(member.studentProfileId);
   return member.studentProfileId;
  });
  return {id:row.teachingContextKey,name:row.operationalName,subject:"unknown" as const,path:"—",time:row.occurrence.localInterval?row.occurrence.localInterval.startsAt.slice(11,16)+"–"+row.occurrence.localInterval.endsAt.slice(11,16):day.localDate,room:"",staff:[],expected:participants[row.teachingContextKey]};
 });
 return {today:day.localDate,staffLabel,classes,data:{students:[...students.values()],participants,diaries:[],openings:{},sequence:0},missions:[],diaryReadState:"UNAVAILABLE",missionReadState:"UNAVAILABLE",openingReadState:"UNAVAILABLE",conflictStudentIds:[...conflicts]};
}
export function validateClassroomDraft(input:{missionIds:string[];results:Record<string,boolean|null>;interest:number|null;notes:string;difficulty:string;hasImage:boolean;uploading:boolean}):string[]{
 const errors:string[]=[];
 if(!input.missionIds.length||input.missionIds.some(id=>typeof id!=="string"||!id.trim()))errors.push("Cần chọn ít nhất một Nhiệm vụ hợp lệ");
 if(input.interest===null||!Number.isInteger(input.interest)||input.interest<1||input.interest>4)errors.push("Chưa chọn mức hứng thú 1–4");
 if(input.interest===1&&!input.difficulty.trim())errors.push("Cần miêu tả khó khăn khi hướng dẫn học viên");
 if(!input.notes.trim())errors.push("Chưa ghi nhận trải nghiệm và lưu ý");
 if(!input.hasImage)errors.push("Cần ít nhất một ảnh bằng chứng");
 if(input.uploading)errors.push("Ảnh đang xử lý, vui lòng đợi");
 return errors;
}
