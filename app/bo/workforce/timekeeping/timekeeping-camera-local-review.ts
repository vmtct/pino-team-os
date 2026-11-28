import type {BoTimekeepingSession,BoTimekeepingPage} from "@/lib/bo-model";
import {createCheckInEvidenceFixture} from "./check-in-evidence-presentation";
export const TIMEKEEPING_REVIEW_ROUTE="/bo/workforce/timekeeping";
export const TIMEKEEPING_REVIEW_CENTER={id:"PAYROLL-CAMERA-MOCK-CENTER",displayName:"Cần Thơ · Mẫu",timeZone:"Asia/Ho_Chi_Minh"};
export const TIMEKEEPING_REVIEW_DATE="2026-11-28";
export function isTimekeepingLocalReview(origin:string,opaqueOrigin:string,path:string,search:string,hash:string){
 return ["http://desktop-isrdren:8800","http://desktop-isrdren.tail3ee007.ts.net:8800","http://192.168.1.6:8800"].includes(origin)&&opaqueOrigin==="null"&&path===TIMEKEEPING_REVIEW_ROUTE&&!search&&!hash;
}
export function createTimekeepingCameraReview(){
 const evidence=createCheckInEvidenceFixture(), recorded={checkInAt:"2026-11-28T11:00:00.000Z",checkOutAt:null,durationSeconds:null};
 const session:BoTimekeepingSession={id:evidence.id,staff:{id:"PAYROLL-CAMERA-MOCK-STAFF",displayLabel:evidence.staffName},centerId:TIMEKEEPING_REVIEW_CENTER.id,workDate:TIMEKEEPING_REVIEW_DATE,assignmentId:"PAYROLL-CAMERA-MOCK-ASSIGNMENT",assignment:{id:"PAYROLL-CAMERA-MOCK-ASSIGNMENT",shiftTemplateId:"PAYROLL-CAMERA-MOCK-SHIFT",workDate:TIMEKEEPING_REVIEW_DATE,status:"ACTIVE",replacesAssignmentId:null,cancelledAt:null,shift:{displayLabel:evidence.assignment,startLocalTime:"18:00",endLocalTime:"21:00"}},...recorded,status:"OPEN",anomalyFlags:[],recorded,effective:{...recorded},latestCorrection:null};
 return {evidence,session};
}
export type TimekeepingCameraReview=ReturnType<typeof createTimekeepingCameraReview>;
export function reviewTimekeepingPage(review:TimekeepingCameraReview,filter:{centerId:string;startDate:string;endDate:string;staffId:string;status:string}):BoTimekeepingPage{
 const row=review.session;
 const data=row.centerId===filter.centerId&&row.workDate>=filter.startDate&&row.workDate<=filter.endDate&&(!filter.staffId||filter.staffId===row.staff.id)&&(!filter.status||filter.status===row.status)?[row]:[];
 return {data,nextCursor:null,summary:{totalSessions:data.length,openSessions:data.length,closedSessions:0}};
}
