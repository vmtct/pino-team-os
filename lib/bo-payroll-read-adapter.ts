import type {BoModuleReadAdapter} from "@/app/bo/architecture/BoModuleFactory";
import {periodApi} from "@/lib/bo-payroll-period-api";
import {payrollAuditTime,payrollVerifiedName} from "@/lib/bo-payroll-safe-read-metadata";
import {periodDisplayName,periodSummaries,staffWithWorkEvidence} from "@/lib/bo-payroll-read-model";

/** Read-only Core payroll projection. Legacy non-BO callers retain their existing
 * multi-Center behavior; a BO Active Center may explicitly bound the request.
 * The server remains responsible for financial authorization and calculations. */
export const payrollPeriodsAdapter={
 async list(fetcher: typeof fetch = fetch, selectedCenterId?: string){
  const response=await fetcher("/api/bo/centers",{credentials:"same-origin",cache:"no-store"});
  const payload=await response.json() as {data?:{id:string;displayName:string;status:string}[];error?:{message?:string}};
  if(!response.ok||!Array.isArray(payload.data))throw new Error(payload.error?.message||"Center read denied");
  const authorized=payload.data.filter(c=>c.status==="active");
  // A session hint never grants salary access; the current Core Center list is required.
  const centers=selectedCenterId?authorized.filter(c=>c.id===selectedCenterId):authorized;
  if(selectedCenterId && centers.length!==1)throw new Error("Payroll Center không được cấp quyền.");
  const rows:Record<string,unknown>[]=[];
  for(const center of centers){
   let offset=0;
   do {
    const p=await periodApi.list(center.id,offset);
    for(const period of p.data.data){
     if(period.centerId!==center.id)throw new Error("Core trả kỳ lương khác cơ sở đã chọn.");
     // Core alone calculates FULL_PERIOD totals, not page-local salary sums.
     const rollup=(await periodApi.staff(center.id,period.id,0)).data;
     if(rollup.totalsScope!=="FULL_PERIOD")throw new Error("Period total scope mismatch");
     const total=periodSummaries(rollup.periodTotals);
     rows.push({
      id:period.id,name:periodDisplayName(period.startDate,center.displayName),
      startDate:period.startDate,endDate:period.endDate,
      centerId:period.centerId,centerName:center.displayName,
      staffCount:rollup.nextOffset===null?staffWithWorkEvidence(rollup.rows).length:null,
      createdAt:payrollAuditTime(period.createdAt),createdBy:payrollVerifiedName(period.createdBy),
      updatedAt:payrollAuditTime(period.updatedAt),updatedBy:payrollVerifiedName(period.updatedBy),
      expected:total.expected,finalized:total.finalized,status:period.status==="ARCHIVED"?"Lưu trữ":"Đang mở"
     });
     if(rows.length>250)throw new Error("Payroll read result exceeds safe bound");
    }
    const next=p.data.nextOffset;
    if(next===null)break;
    if(next<=offset)throw new Error("Invalid payroll pagination");
    offset=next;
   }while(true);
  }
  return rows;
 }
} satisfies BoModuleReadAdapter;
