import type {BoModuleReadAdapter} from "@/app/bo/architecture/BoModuleFactory";
import {periodApi} from "@/lib/bo-payroll-period-api";
import {periodDisplayName,periodSummaries,staffWithWorkEvidence} from "@/lib/bo-payroll-read-model";

/** Fail closed if any Center financial GET is denied. No mutations, browser fixtures or cached salary payload. */
export const payrollPeriodsAdapter:BoModuleReadAdapter={
 async list(){
  const response=await fetch("/api/bo/centers",{credentials:"same-origin",cache:"no-store"});
  const payload=await response.json() as {data?:{id:string;displayName:string;status:string}[];error?:{message?:string}};
  if(!response.ok||!Array.isArray(payload.data))throw new Error(payload.error?.message||"Center read denied");
  const centers=payload.data.filter(c=>c.status==="active");
  const rows:Record<string,unknown>[]=[];
  for(const center of centers){
   let offset=0;
   do {
    const p=await periodApi.list(center.id,offset);
    for(const period of p.data.data){
     // Core is the only amount calculator: FULL_PERIOD totals, not page-local sums.
     const rollup=(await periodApi.staff(center.id,period.id,0)).data;
     if(rollup.totalsScope!=="FULL_PERIOD")throw new Error("Period total scope mismatch");
     const total=periodSummaries(rollup.periodTotals);
     rows.push({
      id:period.id,name:periodDisplayName(period.startDate,center.displayName),
      startDate:period.startDate,endDate:period.endDate,
      centerId:period.centerId,centerName:center.displayName,
      staffCount:rollup.nextOffset===null?staffWithWorkEvidence(rollup.rows).length:null,
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
};
