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

