/** PAP-802 authenticated TOS own-staff request client. No salary values or staff IDs sent. */
export interface OwnExtraTimeRequest {
  id:string;centerId:string;staffMemberId:string;assignmentId:string;
  workDate:string;startAt:string;endAt:string;reason:string;
  status:"PENDING"|"WITHDRAWN"|"APPROVED"|"REJECTED";createdAt:string;createdByUserId:string;
  review?:{type:"APPROVED"|"REJECTED";reason:string;approvedStartAt:string|null;
    approvedEndAt:string|null;reviewedAt:string}|null;
}
export interface ExtraTimePage {
  data:OwnExtraTimeRequest[];total:number;nextOffset:number|null;
}
export interface OwnShift {
  id:string;centerId:string;workDate:string;status:string;
  shift:{displayLabel:string}|null;
}
export interface AttendanceEvidence {
  id:string;centerId:string;assignmentId:string|null;workDate:string;
  status:"OPEN"|"CLOSED";checkInAt:string;checkOutAt:string|null;
}
export interface EligibleTimeWindow {
  key:string;assignmentId:string;workDate:string;label:string;
  checkInAt:string;checkOutAt:string;
}
export class ExtraTimeApiError extends Error{
  constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
async function call<T>(query:string,init:RequestInit={}):Promise<T>{
  const response=await fetch("/api/tos-learning/workforce/payroll/extra-time"+query,{
    ...init,cache:"no-store",headers:{
      ...(init.body?{"content-type":"application/json"}:{}),...init.headers,
    },
  });
  const body=await response.json() as T&{error?:{code?:string;message?:string}};
  if(!response.ok)throw new ExtraTimeApiError(response.status,body.error?.code??"UNKNOWN",
    body.error?.message??"Không thể xử lý yêu cầu tính thêm giờ.");
  return body;
}
export const extraTimeApi={
  ownHistory:(centerId:string,workDate?:string,limit=50,offset=0)=>
    call<{data:ExtraTimePage}>("?"+new URLSearchParams({
      centerId,...(workDate?{workDate}:{}),limit:String(limit),offset:String(offset),
    }).toString()),
  request:(input:{
    centerId:string;assignmentId:string;workDate:string;
    startAt:string;endAt:string;reason:string;
  },idempotencyKey:string)=>
    call<{data:OwnExtraTimeRequest}>("",{
      method:"POST",headers:{"idempotency-key":idempotencyKey},
      body:JSON.stringify(input),
    }),
};
export function availableExtraTimeWindows(
  assignments:readonly OwnShift[],attendance:readonly AttendanceEvidence[],centerId:string,
):EligibleTimeWindow[]{
  const assignmentMap=new Map(assignments
    .filter(a=>a.centerId===centerId&&a.status==="ACTIVE").map(a=>[a.id,a]));
  const seen=new Set<string>(),choices:EligibleTimeWindow[]=[];
  for(const session of attendance){
    if(session.centerId!==centerId||session.status!=="CLOSED"||
       !session.assignmentId||!session.checkOutAt)continue;
    const assignment=assignmentMap.get(session.assignmentId);
    if(!assignment||assignment.workDate!==session.workDate)continue;
    const key=session.id;
    if(seen.has(key))continue;
    seen.add(key);
    choices.push({
      key,assignmentId:assignment.id,workDate:assignment.workDate,
      label:assignment.workDate+" · "+(assignment.shift?.displayLabel??"Ca làm") ,
      checkInAt:session.checkInAt,checkOutAt:session.checkOutAt,
    });
  }
  return choices.sort((a,b)=>b.workDate.localeCompare(a.workDate)||a.key.localeCompare(b.key));
}
export function formatVietnamTime(value:string):string{
  const epoch=Date.parse(value);
  return Number.isFinite(epoch)
    ?new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(epoch))
    :"--:--";
}
export function createExtraTimePayload(
  selected:EligibleTimeWindow|undefined,centerId:string,from:string,to:string,reason:string,
):{centerId:string;assignmentId:string;workDate:string;startAt:string;endAt:string;reason:string}{
  if(!selected||!centerId||!isClock(from)||!isClock(to)||to<=from)
    throw new Error("Vui lòng chọn ca và khoảng giờ hợp lệ.");
  const trimmed=reason.trim();
  if(trimmed.length<10||trimmed.length>1000)
    throw new Error("Lý do làm thêm phải dài từ 10 đến 1000 ký tự.");
  const startAt=selected.workDate+"T"+from+":00+07:00";
  const endAt=selected.workDate+"T"+to+":00+07:00";
  const start=Date.parse(startAt),end=Date.parse(endAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end-start>12*60*60_000)
    throw new Error("Khoảng yêu cầu tối đa 12 giờ.");
  // Local estimate only. Core enforces authoritative latest Timekeeping corrections.
  if(start<Date.parse(selected.checkInAt)||end>Date.parse(selected.checkOutAt))
    throw new Error("Khoảng giờ phải nằm trong check-in/out đã ghi nhận.");
  return {centerId,assignmentId:selected.assignmentId,workDate:selected.workDate,
    startAt,endAt,reason:trimmed};
}
function isClock(value:string){return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
