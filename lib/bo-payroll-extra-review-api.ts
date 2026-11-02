/** PAP-803 BO-only client of Core's authorized exception review contract. */
export type ReviewStatus="PENDING"|"WITHDRAWN"|"APPROVED"|"REJECTED";
export interface ReviewedException {
  id:string;centerId:string;staffMemberId:string;assignmentId:string;workDate:string;
  requestedStartAt:string;requestedEndAt:string;requestReason:string;status:ReviewStatus;
  decision:null|{
    id:string;type:"APPROVED"|"REJECTED";startAt:string|null;endAt:string|null;
    minutes:number|null;hourlyRateMinor:number|null;rateEntryId:string|null;
    rateVersion:number|null;amountMinor:number|null;reason:string;
    reviewerId:string;reviewedAt:string;sourceFingerprint:string|null;
  };
}
export interface ReviewPage{data:ReviewedException[];total:number;nextOffset:number|null}
export class ReviewApiError extends Error {
  constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
const ROOT="/api/bo/workforce/payroll/extra-time/reviews";
async function call<T>(url:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(url,{
    ...options,cache:"no-store",credentials:"same-origin",
    headers:{...(options.body?{"content-type":"application/json"}:{}),...options.headers},
  });
  const json=await response.json() as T&{error?:{code?:string;message?:string;requestId?:string}};
  if(!response.ok)throw new ReviewApiError(response.status,json.error?.code??"UNKNOWN",
    json.error?.message??"Không thể kết nối dữ liệu ngoại lệ từ Core.");
  return json;
}
export const reviewApi={
  list:(input:{centerId:string;startDate:string;endDate:string;status?:ReviewStatus;
    limit?:number;offset?:number})=>
      call<{data:ReviewPage}>(ROOT+"?"+new URLSearchParams({
        centerId:input.centerId,startDate:input.startDate,endDate:input.endDate,
        ...(input.status?{status:input.status}:{}),
        limit:String(input.limit??50),offset:String(input.offset??0),
      })),
  get:(centerId:string,requestId:string)=>
    call<{data:ReviewedException}>(ROOT+"/"+requestId+"?"+new URLSearchParams({centerId})),
  decide:(input:{centerId:string;requestId:string;decision:"APPROVED"|"REJECTED";
    reason:string;approvedStartAt?:string;approvedEndAt?:string},idempotencyKey:string)=>{
    const {requestId,...body}=input;
    return call<{data:ReviewedException}>(ROOT+"/"+requestId+"/decision?"+
      new URLSearchParams({centerId:input.centerId}),{
      method:"POST",headers:{"idempotency-key":idempotencyKey},body:JSON.stringify(body),
    });
  },
};
export function localClock(value:string|null):string{
  if(!value)return "";
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed))return "";
  return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",
    hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(parsed));
}
export function reviewedAmount(value:number|null):string{
  if(value===null)return "Chưa chốt";
  return new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(value)+" ₫";
}
export function decisionPayload(row:ReviewedException,mode:"FULL"|"PARTIAL"|"REJECTED",
  from:string,to:string,reason:string){
  const text=reason.trim();
  if(text.length<10||text.length>1000)throw new Error("Lý do phải từ 10 đến 1000 ký tự.");
  if(mode==="REJECTED")return {
    centerId:row.centerId,requestId:row.id,decision:"REJECTED" as const,reason:text,
  };
  const approvedStartAt=mode==="FULL"?row.requestedStartAt:row.workDate+"T"+from+":00+07:00";
  const approvedEndAt=mode==="FULL"?row.requestedEndAt:row.workDate+"T"+to+":00+07:00";
  const start=Date.parse(approvedStartAt),end=Date.parse(approvedEndAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||start<Date.parse(row.requestedStartAt)||
    end>Date.parse(row.requestedEndAt)||start%60000!==0||end%60000!==0)
    throw new Error("Khoảng duyệt phải nằm trong giờ yêu cầu và chính xác đến phút.");
  return {centerId:row.centerId,requestId:row.id,decision:"APPROVED" as const,
    approvedStartAt,approvedEndAt,reason:text};
}
