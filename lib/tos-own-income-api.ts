/** PAP-809 read-only, authenticated staff-self income history. Never accepts a staff ID. */
export interface OwnIncomePeriod {
  periodId:string;name:string;startDate:string;endDate:string;
  status:"DRAFT"|"FINALIZED"|"PAID"|"ARCHIVED_UNAVAILABLE";
  amountMinor:number|null;standardMinor:number|null;extraTimeMinor:number|null;
  adjustmentsMinor:number|null;paidMinutes:number|null;warnings:string[];
  finalizedAt:string|null;paidAt:string|null;paymentDate:string|null;
  estimateAvailable:boolean;
}
export interface OwnIncomePage {data:OwnIncomePeriod[];total:number;nextOffset:number|null}
export class OwnIncomeApiError extends Error {
 constructor(readonly status:number,message:string){super(message);this.name="OwnIncomeApiError";}
}
export async function ownIncome(centerId:string,limit=20,offset=0):Promise<OwnIncomePage>{
  const query=new URLSearchParams({centerId,limit:String(limit),offset:String(offset)});
  const response=await fetch("/api/tos-learning/workforce/payroll/income?"+query,{
    method:"GET",cache:"no-store",headers:{"cache-control":"no-store"},
  });
  const body=await response.json() as {data?:OwnIncomePage;error?:{message?:string}};
  if(!response.ok||!body.data)throw new OwnIncomeApiError(response.status,response.status===403
    ?"Bạn chưa có quyền xem thu nhập tại cơ sở này."
    :body.error?.message??"Không thể tải lịch sử thu nhập.");
  return body.data;
}
