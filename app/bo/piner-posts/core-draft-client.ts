/** PAP-2228 / PAP-1746: Core-backed Person subject and Post draft client. */
import type {PostShellRow,PostProgramKey} from "./data-port";
export type CoreDraftRow=PostShellRow & {
 readonly studentId:string|null;readonly personId:string|null;readonly personName:string|null;
 readonly programKey:PostProgramKey;readonly centerId:string;readonly version:number;readonly mediaCount:number
};
export type CorePersonOption={personId:string;displayName:string|null;ageYears:number|null;phoneLast4:string|null;actorLabels:readonly string[]};
type Page={rows:readonly CoreDraftRow[];nextBeforeId:string|null};
type Write={row:CoreDraftRow;committedVersion:number;replayed:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function id(x:unknown):string{if(typeof x!=="string"||!uuid.test(x))throw Error("Định danh không hợp lệ.");return x;}
function obj(x:unknown):Record<string,unknown>{if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Phản hồi Post không hợp lệ.");return x as Record<string,unknown>;}
function text(x:unknown):string{if(typeof x!=="string")throw Error("Phản hồi Post không hợp lệ.");return x;}
function nullableText(x:unknown):string|null{return x===null?null:text(x);}
function version(x:unknown):number{if(typeof x!=="number"||!Number.isSafeInteger(x)||x<1)throw Error("Phiên bản Post không hợp lệ.");return x;}
function label(x:unknown):string|null{return x===null?null:text(x);}
function instant(x:unknown):string{const v=text(x);if(!Number.isFinite(Date.parse(v)))throw Error("Thời gian Post không hợp lệ.");return v;}
function key(x:string){if(!/^[A-Za-z0-9_-]{16,128}$/.test(x))throw Error("Mã yêu cầu không hợp lệ.");return x;}
function program(x:unknown):PostProgramKey{if(x!=="AFTERSCHOOL"&&x!=="MYTIME")throw Error("Chương trình Post không hợp lệ.");return x;}
function projection(raw:unknown,centerId:string):CoreDraftRow{
 const r=obj(raw),recordId=id(r.id),center=id(r.centerId),programKey=program(r.programKey);
 const studentId=r.studentId===null?null:id(r.studentId),personId=r.personId===null?null:id(r.personId);
 const publisher=programKey==="AFTERSCHOOL"?"PINO Afterschool":"MyTime by PINO";
 if(center!==centerId||(r.status!=="DRAFT"&&r.status!=="PENDING_APPROVAL")||r.publisher!==publisher)throw Error("Post không thuộc phạm vi đã chọn.");
 const personName=nullableText(r.personName),studentName=nullableText(r.studentName),displayName=personName??studentName??"—";
 const mediaCount=r.mediaCount===undefined?0:r.mediaCount;if(typeof mediaCount!=="number"||!Number.isSafeInteger(mediaCount)||mediaCount<0||mediaCount>5)throw Error("Invalid Post media count.");
 return {id:recordId,studentId,personId,personName,programKey,centerId:center,version:version(r.version),name:displayName,program:publisher,caption:text(r.caption),author:publisher,status:r.status==="DRAFT"?"Nháp":"Chờ duyệt",center:text(r.centerName),source:"Chưa có",mediaCount,commentCount:0,createdAt:instant(r.createdAt),updatedAt:instant(r.updatedAt),createdBy:label(r.createdBy),updatedBy:label(r.updatedBy)};
}
function personOption(raw:unknown):CorePersonOption{
 const r=obj(raw),personId=id(r.personId),displayName=nullableText(r.displayName);
 const rawAge=r.ageYears;
 const ageYears=rawAge===null?null:(typeof rawAge==="number"&&Number.isSafeInteger(rawAge)&&rawAge>=0&&rawAge<=130?rawAge:(()=>{throw Error("Tuổi Person không hợp lệ.");})());
 const phoneLast4=nullableText(r.phoneLast4);
 if(phoneLast4!==null&&!/^\d{4}$/.test(phoneLast4))throw Error("Số điện thoại Person không hợp lệ.");
 if(!Array.isArray(r.actorLabels)||r.actorLabels.some(v=>typeof v!=="string"||!["STUDENT","STAFF","PARENT","GUEST"].includes(v)))throw Error("Vai trò Person không hợp lệ.");
 return {personId,displayName,ageYears,phoneLast4,actorLabels:r.actorLabels as string[]};
}
export class CoreDraftRequestError extends Error{
 constructor(readonly status:number,readonly operation?:"create"){super(status===404&&operation==="create"?"Person không còn đủ điều kiện tại cơ sở đã chọn. Hãy chọn lại Person.":({401:"Phiên đăng nhập đã hết hạn.",403:"Bạn không có quyền với Post này.",404:"Không tìm thấy Post trong cơ sở.",409:"Post đã thay đổi. Tải lại trước khi cập nhật."} as Record<number,string>)[status]??"Không thể tải hoặc lưu Post.");}
}
export function coreDraftClient(centerId:string,fetcher:typeof fetch=fetch){
 id(centerId);
 const base="/api/bo/learning/piner-posts";
 async function request(method:"GET"|"POST"|"PATCH",signal:AbortSignal,opts:{postId?:string;people?:boolean;params?:Record<string,string>;body?:object;idempotencyKey?:string}={}){
  signal.throwIfAborted();const q=new URLSearchParams({centerId,...opts.params});
  const url=base+(opts.people?"/people":opts.postId?"/"+id(opts.postId):"")+"?"+q.toString();
  const headers=new Headers({Accept:"application/json"});
  if(opts.body)headers.set("Content-Type","application/json");
  if(opts.idempotencyKey!==undefined)headers.set("Idempotency-Key",key(opts.idempotencyKey));
  const response=await fetcher(url,{method,signal,headers,cache:"no-store",credentials:"same-origin",redirect:"error",...(opts.body?{body:JSON.stringify(opts.body)}:{})});
  signal.throwIfAborted();if(!response.ok)throw new CoreDraftRequestError(response.status,method==="POST"?"create":undefined);
  const result=obj(await response.json()).data;signal.throwIfAborted();return result;
 }
 function write(raw:unknown,expectedPost?:string,expectedPerson?:string,expectedProgram?:PostProgramKey):Write{
  const result=obj(raw),row=projection(result.post,centerId),committedVersion=version(result.committedVersion);
  if(typeof result.replayed!=="boolean"||committedVersion>row.version||(!result.replayed&&committedVersion!==row.version)||expectedPost&&row.id!==expectedPost||expectedPerson&&row.personId!==expectedPerson||expectedProgram&&row.programKey!==expectedProgram)throw Error("Phản hồi lưu Post không khớp.");
  return {row,committedVersion,replayed:result.replayed};
 }
 return {
  centerId,
  async list(signal:AbortSignal,beforeId?:string,limit=50):Promise<Page>{
   if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error("Giới hạn danh sách không hợp lệ.");
   const data=obj(await request("GET",signal,{params:{limit:String(limit),...(beforeId?{beforeId:id(beforeId)}:{})}}));
   if(!Array.isArray(data.posts)||data.posts.length>limit)throw Error("Danh sách Post không hợp lệ.");
   const rows=data.posts.map(r=>projection(r,centerId)),nextBeforeId=data.nextBeforeId===null?null:id(data.nextBeforeId);
   if(new Set(rows.map(r=>r.id)).size!==rows.length||(nextBeforeId!==null&&nextBeforeId!==rows.at(-1)?.id)||rows.some((r,i)=>i>0&&r.id>=rows[i-1]!.id)||beforeId&&rows.some(r=>r.id>=beforeId))throw Error("Phân trang Post không hợp lệ.");
   return {rows,nextBeforeId};
  },
  async personOptions(programKey:PostProgramKey,signal:AbortSignal,q="",after?:string,limit=100){
   if(!Number.isSafeInteger(limit)||limit<1||limit>100||q.length>120||[...q].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw Error("Bộ lọc Person không hợp lệ.");
   const data=obj(await request("GET",signal,{people:true,params:{programKey,q,limit:String(limit),...(after?{after:id(after)}:{})}}));
   if(!Array.isArray(data.people)||data.people.length>limit)throw Error("Danh bạ Person không hợp lệ.");
   const people=data.people.map(personOption),nextAfter=data.nextAfter===null?null:id(data.nextAfter);
   if(nextAfter!==null&&nextAfter!==people.at(-1)?.personId)throw Error("Phân trang Person không hợp lệ.");
   return {people,nextAfter};
  },
  async detail(postId:string,signal:AbortSignal){const row=projection(await request("GET",signal,{postId:id(postId)}),centerId);if(row.id!==postId)throw Error("Post không khớp.");return row;},
  async createDraft(input:{personId:string;programKey:PostProgramKey;caption:string;idempotencyKey:string},signal:AbortSignal){return write(await request("POST",signal,{body:{personId:id(input.personId),programKey:program(input.programKey),caption:input.caption},idempotencyKey:input.idempotencyKey}),undefined,input.personId,input.programKey);},
  async editCaption(input:{postId:string;caption:string;expectedVersion:number;idempotencyKey:string},signal:AbortSignal){
   const result=write(await request("PATCH",signal,{postId:id(input.postId),body:{caption:input.caption,expectedVersion:version(input.expectedVersion)},idempotencyKey:input.idempotencyKey}),input.postId);
   if(result.committedVersion!==input.expectedVersion+1)throw Error("Phiên bản lưu không khớp.");return result;
  },
 };
}
