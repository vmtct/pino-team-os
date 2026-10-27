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

/** Never prefill arbitrary Staff. This is a conservative subset where Core exposes work evidence.
 * Missing-checkout-only attendance requires a future dedicated Core attendance-evidence flag.
 */
export function staffWithWorkEvidence(rows:PeriodStaff[]):PeriodStaff[]{
 return rows.filter(row=>row.status==="FINALIZED"||row.status==="PAID"||
  row.preview?.days?.some(d=>d.paidMinutes!==null&&d.paidMinutes>=0));
}
