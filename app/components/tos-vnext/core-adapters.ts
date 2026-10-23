/**
 * PAP-938 VNext runtime adapters: single source of real read paths.
 * No parallel Core truth, no fake successful mutation, and no production exposure.
 * Some existing clients are LEGACY session / Training F0 only — never label those VNext complete.
 */
import {workforceApi,type Assignment,type StaffDutyBoard,type TimekeepingSession,type WorkforceContext} from "@/lib/workforce-api";
import {ownIncome,type OwnIncomePage} from "@/lib/tos-own-income-api";
import {tosDayOfLearningApi,type StudentVisit} from "@/lib/tos-day-of-learning-api";
import {tosLearningApi,type DaySession,type SessionRoster} from "@/lib/tos-learning-api";
import {workforceTraining} from "@/lib/workforce-training-client";
import type {TrainingSelfProjection} from "@/lib/training-model";
import type {TosVNextAppId} from "./identity";

export type TosBackendReadiness="WIRED_READ"|"LEGACY_ONLY"|"CORE_PR_PENDING"|"MISSING_CONTRACT"|"SECURITY_DEPENDENCY";
export interface TosBackendSurface {app:TosVNextAppId;capability:string;status:TosBackendReadiness;owner:string;description:string}
export const TOS_BACKEND_MATRIX=[
 {app:"shift",capability:"shift schedule/timekeeping",status:"WIRED_READ",owner:"PAP-700",description:"workforceApi.context/schedule/currentTimekeeping"},
 {app:"shift",capability:"staff own income history",status:"WIRED_READ",owner:"PAP-799",description:"ownIncome self scope, no staff-ID query"},
 {app:"shift",capability:"photo-only check-in",status:"SECURITY_DEPENDENCY",owner:"PAP-868/869",description:"Never call direct legacy checkIn without camera intent & atomic proof"},
 {app:"reception",capability:"student open visit",status:"WIRED_READ",owner:"Learning Core",description:"tosDayOfLearningApi.openVisit"},
 {app:"reception",capability:"reception checkout/pickup",status:"SECURITY_DEPENDENCY",owner:"PAP-942",description:"Visit APIs exist; pickup verification and Front Desk policy must be accepted"},
 {app:"reception",capability:"Pinoria wish counter",status:"MISSING_CONTRACT",owner:"PAP-942",description:"Do not claim a live Wish settlement backend"},
 {app:"station",capability:"station node/TV/device workspace",status:"MISSING_CONTRACT",owner:"PAP-943",description:"No verified workstation device command API"},
 {app:"shift-lead",capability:"shift-context duty projections",status:"WIRED_READ",owner:"PAP-671",description:"workforceApi.dutyBoard, Core still enforces permissions"},
 {app:"shift-lead",capability:"station-wide management",status:"MISSING_CONTRACT",owner:"PAP-944",description:"Shift-leader scope/action policy not yet accepted"},
 {app:"classroom",capability:"legacy session/day roster read",status:"LEGACY_ONLY",owner:"PAP-727",description:"tosLearningApi.sessionsDay/roster returns Session-based data; not approved V18b session-free Path Diary"},
 {app:"classroom",capability:"Path Diary REGISTERED/CLOSED",status:"CORE_PR_PENDING",owner:"PAP-724/945",description:"Core PR #1770 unmerged/conflicting; V18b Diary register/draft/missions/evidence/close needs verified live contract"},
 {app:"training",capability:"staff own legacy training",status:"LEGACY_ONLY",owner:"PAP-847",description:"workforceTraining.self is old assignment/Skill Passport, NOT Training V5 register/cert API"},
 {app:"training",capability:"V5 catalog/registration/eligibility",status:"CORE_PR_PENDING",owner:"PAP-848/849/946",description:"Typed read UI ready; Core PRs #1793/#1794 unmerged; registration/cancel disabled until verified Core"}
] as const satisfies readonly TosBackendSurface[];

export class TosVNextScopeError extends Error {
 constructor(message="Cơ sở này không thuộc phạm vi được cấp quyền."){super(message);this.name="TosVNextScopeError"}
}
export async function staffContext():Promise<WorkforceContext>{return (await workforceApi.context()).data}
export function assertOwnCenter(context:WorkforceContext,centerId:string){
 const center=context.centers.find(x=>x.id===centerId);
 if(!center)throw new TosVNextScopeError();
 return center;
}
/** Fail closed if context or Core scope fails. Read-only; no client trust of mock role. */
export type TosVNextShiftReadWarnings=Partial<Record<"timekeeping"|"history"|"income",string>>;
export async function shiftReadModel(centerId:string,fromDate:string,toDate:string):Promise<{
 context:WorkforceContext;
 assignments:Assignment[];
 current:TimekeepingSession|null;
 history:TimekeepingSession[]|null;
 income:OwnIncomePage|null;
 warnings:TosVNextShiftReadWarnings;
}>{
 const context=await staffContext();
 assertOwnCenter(context,centerId);
 // Schedule is the mandatory source of shift-role access. NEVER infer permissions
 // from optional payroll/timekeeping success or preserve stale shift assignments.
 const assignments=await workforceApi.schedule({centerId,startDate:fromDate,endDate:toDate});
 const [current,history,income]=await Promise.allSettled([
  workforceApi.currentTimekeeping(centerId),
  workforceApi.history({centerId,startDate:fromDate,endDate:toDate}),
  ownIncome(centerId,20,0)
 ]);
 // Session expiry invalidates the entire read. A 403 can instead mean
 // a single optional feature is forbidden: keep that feature hidden while
 // preserving Core-backed schedule access to otherwise authorized apps.
 for(const result of [current,history,income]){
  if(result.status==="rejected"&&result.reason?.status===401)throw result.reason;
 }
 const warnings:TosVNextShiftReadWarnings={};
 const unavailable=(name:keyof TosVNextShiftReadWarnings,reason:unknown)=>{
  warnings[name]=reason instanceof Error?reason.message:"Không thể tải dữ liệu Core.";
 };
 if(current.status==="rejected")unavailable("timekeeping",current.reason);
 if(history.status==="rejected")unavailable("history",history.reason);
 if(income.status==="rejected")unavailable("income",income.reason);
 return {
  context,assignments:assignments.data,
  current:current.status==="fulfilled"?current.value.data:null,
  history:history.status==="fulfilled"?history.value.data:null,
  income:income.status==="fulfilled"?income.value:null,
  warnings
 };
}
export async function receptionVisitReadModel(centerId:string,studentProfileId:string):Promise<StudentVisit|null>{
 assertOwnCenter(await staffContext(),centerId);
 if(!studentProfileId.trim())throw new Error("Thiếu học viên.");
 return (await tosDayOfLearningApi.openVisit(studentProfileId,centerId)).data;
}
/** LEGACY_ONLY: read-projection to discover an existing Core API, never V18b Diary acceptance. */
export async function classroomLegacyReadModel(centerId:string,localDate:string):Promise<DaySession[]>{
 assertOwnCenter(await staffContext(),centerId);
 return (await tosLearningApi.sessionsDay(centerId,localDate)).data.sessions;
}
export async function classroomLegacyRoster(sessionId:string):Promise<SessionRoster>{
 if(!sessionId.trim())throw new Error("Thiếu ngữ cảnh phiên lớp.");
 return (await tosLearningApi.roster(sessionId)).data;
}
export async function ownLegacyTrainingReadModel():Promise<TrainingSelfProjection>{
 await staffContext(); // Authenticated own-staff scope, never ask for another staff ID.
 return workforceTraining.self();
}
/** Only contextual Duty read: no standalone task application. */
export async function dutyContextReadModel(centerId:string,localDate:string):Promise<StaffDutyBoard>{
 assertOwnCenter(await staffContext(),centerId);
 return (await workforceApi.dutyBoard({centerId,workDate:localDate})).data;
}
