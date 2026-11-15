import {periodApi,type PeriodStaff,type PayPeriod,type PeriodStaffPage} from "./bo-payroll-period-api";
export type IncomePeriod = {period:Pick<PayPeriod,"id"|"name"|"startDate"|"endDate"|"status">;staff:PeriodStaff};
export type IncomePage = {centerId:string;staffMemberId:string;anchorPeriodId:string;current:IncomePeriod;rows:IncomePeriod[];offset:number;nextOffset:number|null};
export function scopedIncomeRow(page:Pick<PeriodStaffPage,"period"|"totalsScope"|"rows">,centerId:string,periodId:string,staffId:string):IncomePeriod|null {
 if(page.period.id!==periodId||page.totalsScope!=="FULL_PERIOD")throw Error("PAYROLL_INCOME_PERIOD_MISMATCH");
 const matches=page.rows.filter(r=>r.staffMemberId===staffId);
 if(matches.length>1)throw Error("PAYROLL_INCOME_DUPLICATE");
 const staff=matches[0];
 if(!staff)return null;
 const p=staff.preview;
 if(p&&(p.centerId!==centerId||p.periodId!==periodId||p.staffMemberId!==staffId||p.periodStartDate!==page.period.startDate||p.periodEndDate!==page.period.endDate))throw Error("PAYROLL_INCOME_SNAPSHOT_SCOPE_MISMATCH");
 if((staff.status==="FINALIZED"||staff.status==="PAID")&&(!staff.settlementId||!p||p.amountMinor!==staff.amountMinor))throw Error("PAYROLL_INCOME_SNAPSHOT_MISSING");
 return {period:page.period,staff};
}
export async function loadIncomeHistory(centerId:string,currentId:string,staffId:string,offset=0,api:Pick<typeof periodApi,"incomeHistory">=periodApi):Promise<IncomePage>{
 const {data:p}=await api.incomeHistory(centerId,currentId,staffId,offset);
 if(p.centerId!==centerId||p.staffMemberId!==staffId||p.anchorPeriodId!==currentId||p.current.period.id!==currentId||p.offset!==offset||!Array.isArray(p.rows)||p.rows.length>5||
 (p.nextOffset!==null&&(!Number.isSafeInteger(p.nextOffset)||p.nextOffset<=offset))||
 new Set([p.current,...p.rows].map(r=>r.period.id)).size!==p.rows.length+1)throw Error("PAYROLL_INCOME_PAGE_SCOPE_MISMATCH");
 for(const row of [p.current,...p.rows]){
  if(!scopedIncomeRow({period:row.period,totalsScope:"FULL_PERIOD",rows:[row.staff]},centerId,row.period.id,staffId))throw Error("PAYROLL_INCOME_STAFF_NOT_FOUND");
 }
 return p;
}


/** Day detail stays within the verified period projection, including frozen settlements. */
export function scopedIncomeDay(row:IncomePeriod,workDate:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||workDate<row.period.startDate||workDate>row.period.endDate)return null;
 const days=row.staff.preview?.days.filter(d=>d.workDate===workDate)??[];
 if(days.length!==1)return null;
 const day=days[0],base=day.base;
 if(base&&(base.centerId!==row.staff.preview?.centerId||base.staffMemberId!==row.staff.staffMemberId||base.workDate!==workDate))return null;
 return day;
}
/** Separate private compensation contract: never accept foreign or malformed rate records. */
export function verifiedCompensationRows(data:import("./bo-model").BoStaffCompensationEntry[],staffId:string){
 if(!Array.isArray(data)||data.some(r=>!r||r.staffMemberId!==staffId||r.currency!=="VND"||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<0||!["CURRENT","HISTORICAL","SCHEDULED"].includes(r.state)||!/^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom))||new Set(data.map(r=>r.id)).size!==data.length)throw Error("Invalid compensation scope");
 return data;
}
/** Private rates require a verified, separately authorized matching rate record. */
export function historicalDayRate(day:import("./bo-payroll-period-api").SettlementDay,rates:import("./bo-model").BoStaffCompensationEntry[]|null){
 const b=day.base;
 if(!b||!rates||b.hourlyRateMinor===null||!Number.isSafeInteger(b.hourlyRateMinor)||b.hourlyRateMinor<0)return null;
 const matches=rates.filter(r=>r.staffMemberId===b.staffMemberId&&r.id===b.rateEntryId&&r.version===b.rateVersion&&r.amountMinor===b.hourlyRateMinor&&r.effectiveFrom<=day.workDate&&(r.periodUntilExclusive===null||r.periodUntilExclusive>day.workDate));
 return matches.length===1?b.hourlyRateMinor:null;
}
