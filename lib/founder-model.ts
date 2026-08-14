export type PathProgram={id:string;code:string;displayName:string;status:string};
export type RunningClass={id:string;name:string;pathProgramId:string;timezone:string;recurrenceWeekdays:number[];startLocalTime:string;endLocalTime:string;defaultCapacity:number;status:"active"|"inactive"|"archived"};
export type Syllabus={id:string;pathProgramId:string;curriculumWeek:number;title:string;shortDescription:string|null;publicDescription:string|null;skillSummary:string|null;keywords:string|null;ageMin:number|null;ageMax:number|null;thumbnailMediaAssetId:string|null;coverMediaAssetId:string|null;thumbnailUrl:string|null;coverUrl:string|null;publicationStatus:"draft"|"published"|"archived"};
export type Session={id:string;runningClassId:string|null;pathProgramId:string|null;syllabusId:string|null;localDate:string|null;startsAt:string;endsAt:string;bookingOpensAt:string;bookingClosesAt:string;availability:{capacity:number;remainingSeats:number;isFull:boolean};accessOffers:Array<{offerType:"explore"|"trial_premium"|"premium_home"}>;status:string};
export type Registration={id:string;sessionId:string;status:string;contactName:string;contactPhone:string;contactEmail:string|null;childName:string;childDateOfBirth:string|null;canonicalStudentId:string|null;createdAt:string};
export type FounderData={paths:PathProgram[];classes:RunningClass[];syllabi:Syllabus[];sessions:Session[];registrations:Registration[]};
export type CanonicalError={error?:{code?:string;message?:string;requestId?:string}};

export const WEEKDAYS=["CN","T2","T3","T4","T5","T6","T7"];
export const WEEKDAY_OPTIONS=[1,2,3,4,5,6,0] as const;
export const OFFER_LABELS={explore:"Explore",trial_premium:"Trial Premium",premium_home:"Premium Home"} as const;
export function pathName(paths:PathProgram[],id:string|null){return paths.find(p=>p.id===id)?.displayName??"Chưa xác định";}
export function syllabusName(items:Syllabus[],id:string|null){return items.find(x=>x.id===id)?.title??"Chưa có giáo án";}
export function weekdayLabels(days:number[]){return [...days].sort((a,b)=>(a||7)-(b||7)).map(day=>WEEKDAYS[day]).join(" · ");}
export function recurrenceWeekdaysFromForm(form:FormData){return form.getAll("weekdays").map(Number);}
export type UploadedMedia={id:string;url:string};export type MediaDraft={thumbnail?:UploadedMedia;cover?:UploadedMedia};
export function withUploadedMedia(state:MediaDraft,role:"thumbnail"|"cover",asset:UploadedMedia):MediaDraft{return{...state,[role]:asset};}
export function syllabusMediaIds(value:Syllabus|null,state:MediaDraft){return{thumbnailMediaAssetId:state.thumbnail?.id??value?.thumbnailMediaAssetId??null,coverMediaAssetId:state.cover?.id??value?.coverMediaAssetId??null};}
export function localDateTime(value:string){return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function toLocalInput(value:Date){const shifted=new Date(value.getTime()-value.getTimezoneOffset()*60000);return shifted.toISOString().slice(0,16);}
export function expectedStart(localDate:string,time:string){return new Date(`${localDate}T${time}:00+07:00`);}
export function bookingDefaults(start:Date,now=new Date()){const close=new Date(start.getTime()-3600000);return now<close?{bookingOpensAt:toLocalInput(now),bookingClosesAt:toLocalInput(close),manual:false}:{bookingOpensAt:"",bookingClosesAt:"",manual:true};}
export function isoFromLocal(value:string){return new Date(value).toISOString();}
export function idempotencyKey(){return crypto.randomUUID();}
