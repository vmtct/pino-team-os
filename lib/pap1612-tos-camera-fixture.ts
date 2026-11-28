import type {ShiftReadData} from "@/app/components/tos-vnext/TosVNextShift";
import type {Assignment} from "@/lib/workforce-api";
export const TOS_CAMERA_REVIEW_DATE="2026-11-28";
export const TOS_CAMERA_REVIEW_CENTER="PAYROLL-CAMERA-MOCK-CENTER";
export function createTosCameraReview():ShiftReadData{
 const assignment:Assignment={id:"PAYROLL-CAMERA-MOCK-001",centerId:TOS_CAMERA_REVIEW_CENTER,workDate:TOS_CAMERA_REVIEW_DATE,shiftTemplateId:"PAYROLL-CAMERA-MOCK-SHIFT",timeBasis:"SHIFT_TEMPLATE",coverageMode:"FULL_SHIFT",effectiveStartLocal:"18:00",effectiveEndLocal:"21:00",termWeekId:null,status:"ACTIVE",shift:{code:"MOCK",displayLabel:"Ca mẫu 18:00–21:00",startLocalTime:"18:00",endLocalTime:"21:00"}};
 return {assignments:[assignment],current:null,history:[],income:{data:[],total:0,nextOffset:null},dailyIncome:{data:[{workDate:TOS_CAMERA_REVIEW_DATE,status:"DRAFT",calculationStatus:"NO_ATTENDANCE",paidMinutes:null,standardMinor:null,extraTimeMinor:null,extraTimePending:false,amountMinor:null}]},warnings:{}};
}