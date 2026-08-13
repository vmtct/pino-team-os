export type PathProgram={id:string;code:string;displayName:string;status:string};
export type RunningClass={id:string;name:string;pathProgramId:string;timezone:string;recurrenceWeekday:number;startLocalTime:string;endLocalTime:string;defaultCapacity:number;status:"active"|"inactive"|"archived"};
export type Syllabus={id:string;pathProgramId:string;curriculumWeek:number;title:string;shortDescription:string|null;publicDescription:string|null;skillSummary:string|null;keywords:string|null;ageMin:number|null;ageMax:number|null;thumbnailMediaAssetId:string|null;coverMediaAssetId:string|null;publicationStatus:"draft"|"published"|"archived"};
export type Session={id:string;runningClassId:string|null;pathProgramId:string|null;syllabusId:string|null;localDate:string|null;startsAt:string;endsAt:string;bookingOpensAt:string;bookingClosesAt:string;availability:{capacity:number;remainingSeats:number;isFull:boolean};accessOffers:Array<{offerType:"explore"|"trial_premium"|"premium_home"}>;status:string};
export type Registration={id:string;sessionId:string;status:string;contactName:string;contactPhone:string;contactEmail:string|null;childName:string;childDateOfBirth:string|null;canonicalStudentId:string|null;createdAt:string};
export type FounderData={paths:PathProgram[];classes:RunningClass[];syllabi:Syllabus[];sessions:Session[];registrations:Registration[]};
export type CanonicalError={error?:{code?:string;message?:string;requestId?:string}};

export const WEEKDAYS=["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
export const OFFER_LABELS={explore:"Explore",trial_premium:"Trial Premium",premium_home:"Premium Home"} as const;
export function pathName(paths:PathProgram[],id:string|null){return paths.find(p=>p.id===id)?.displayName??"Chưa xác định";}
export function syllabusName(items:Syllabus[],id:string|null){return items.find(x=>x.id===id)?.title??"Chưa có giáo án";}
export function localDateTime(value:string){return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function toLocalInput(value:Date){const shifted=new Date(value.getTime()-value.getTimezoneOffset()*60000);return shifted.toISOString().slice(0,16);}
export function expectedStart(localDate:string,time:string){return new Date(`${localDate}T${time}:00+07:00`);}
export function bookingDefaults(start:Date,now=new Date()){const close=new Date(start.getTime()-3600000);return now<close?{bookingOpensAt:toLocalInput(now),bookingClosesAt:toLocalInput(close),manual:false}:{bookingOpensAt:"",bookingClosesAt:"",manual:true};}
export function isoFromLocal(value:string){return new Date(value).toISOString();}
export function idempotencyKey(){return crypto.randomUUID();}
