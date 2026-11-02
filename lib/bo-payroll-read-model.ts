import type {PeriodStaff,PeriodStaffPage} from "./bo-payroll-period-api";

/** Display-only; period identity stays Core id. Ignore endDate and persisted name. */
export function periodDisplayName(startDate:string,centerName:string):string {
 const match=/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.exec(startDate);
 if(!match||!centerName.trim())return "Kỳ lương chưa đủ dữ liệu";
 return "Lương tháng "+Number(match[1])+" - "+centerName.trim();
}

/** Server-authored FULL_PERIOD buckets: finalized snapshots include legacy PAID as a Core state. */
export function periodSummaries(t:PeriodStaffPage["periodTotals"]):{expected:number;finalized:number}{
 const expected=t.knownMinor,finalized=t.finalizedMinor+t.paidMinor;
 if (![expected,finalized].every(v=>Number.isSafeInteger(v)&&v>=0)||finalized>expected)
  throw new Error("Payroll aggregation invalid");
 return {expected,finalized};
}

/** Only a real time clock proves attendance. Preserve immutable financial snapshots
 * even when a historical adjustment/finalization has no Timekeeping. During staggered Core
 * release, fallback to existing preview only if the new evidence flag is absent.
 */
export function staffWithWorkEvidence(rows:PeriodStaff[]):PeriodStaff[]{
 return rows.filter(row=>{
  if(row.status==="FINALIZED"||row.status==="PAID")return true;
  if(typeof row.hasTimekeepingEvidence==="boolean")return row.hasTimekeepingEvidence;
  return !!row.preview?.days?.some(d=>d.paidMinutes!==null&&d.paidMinutes>=0);
 });
}
