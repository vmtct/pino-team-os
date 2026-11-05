import {parseHoShiftTemplates} from "./ho-shift-templates-read-facade";

export type CreatePayload=Readonly<{
  scopeType:"GLOBAL"|"CENTER";centerId:string|null;code:string;displayLabel:string;
  startLocalTime:string;endLocalTime:string;status:"ACTIVE"|"INACTIVE";
}>;
type State="clean"|"rejected"|"unknown"|"absent"|"conflict"|"committed";
const endpoint="/api/ho/workforce/shift-templates";
const matches=(payload:CreatePayload,row:unknown)=>Boolean(row&&typeof row==="object"&&
  Object.entries(payload).every(([key,value])=>(row as Record<string,unknown>)[key]===value));
const scope=(payload:CreatePayload)=>payload.scopeType==="GLOBAL"?"GLOBAL":payload.centerId!;

/** PAP-1463: session-local attempt evidence, never a substitute for Core truth.
 * Core atomically stores the command fingerprint/receipt. Replays must retain
 * the exact serialized payload and key, even when readback currently says absent.
 */
export class HoCreateRecovery {
  state:State="clean";
  diagnostic="";
  private attempt?:Readonly<{payload:CreatePayload;body:string;key:string}>;
  private inFlight=false;
  private record(message:string){this.diagnostic=(this.diagnostic?this.diagnostic+"; ":"")+message;}
  get locked(){return !["clean","rejected"].includes(this.state);}
  get canSubmit(){return ["clean","rejected","absent"].includes(this.state)&&!this.inFlight;}
  get key(){return this.attempt?.key;}
  async submit(payload:CreatePayload,fetcher:typeof fetch=fetch,newKey:()=>string=()=>crypto.randomUUID()):Promise<void>{
    if(!this.canSubmit)return;
    const replay=this.state==="absent";
    if(replay&&!matches(this.attempt!.payload,payload))return;
    this.inFlight=true;
    try{
      if(!replay){
        this.attempt=Object.freeze({payload:Object.freeze({...payload}),body:JSON.stringify(payload),key:newKey()});
        this.diagnostic="";
      }
      const attempt=this.attempt!;
      // Mark unknown before dispatch; a thrown fetch/invalid receipt is never a rejection.
      this.state="unknown";
      const response=await fetcher(endpoint,{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
        headers:{"content-type":"application/json","idempotency-key":attempt.key},body:attempt.body});
      const body:unknown=await response.json().catch(()=>null);
      const code=(body as {error?:{code?:unknown}}|null)?.error?.code;
      this.record(`POST ${response.status}${typeof code==="string"?" · "+code:""}`);
      // BFF readback can itself return 401/403/404 after commit. Only errors
      // proven to originate before the initial atomic create release the draft.
      const rejected=!replay&&(
        response.status===400&&code==="PLATFORM_INVALID_INPUT"||
        response.status===403&&["HO_REQUEST_DENIED","HO_SHIFT_TEMPLATE_MUTATION_DENIED","HO_ACCESS_DENIED"].includes(String(code))||
        response.status===404&&code==="PLATFORM_NOT_FOUND"||
        response.status===409&&code==="WORKFORCE_SHIFT_CONFLICT");
      if(rejected){this.state="rejected";return;}
      if(replay&&response.status===409){this.state="conflict";return;}
      if(response.status!==201)return;
      const rows=parseHoShiftTemplates({data:[(body as {data?:unknown}|null)?.data]},scope(attempt.payload));
      if(rows?.length===1&&matches(attempt.payload,rows[0]))this.state="committed";
      else this.diagnostic+=" · Receipt không hợp lệ hoặc không khớp.";
    }catch{
      this.state="unknown";this.record("POST không có xác nhận hợp lệ (mạng/timeout).");
    }finally{this.inFlight=false;}
  }
  async reconcile(fetcher:typeof fetch=fetch):Promise<void>{
    if(this.inFlight||!this.attempt||!this.locked||this.state==="committed")return;
    this.inFlight=true;
    const attempt=this.attempt;
    try{
      const response=await fetcher(endpoint+"?centerId="+encodeURIComponent(scope(attempt.payload)),{
        method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",
      });
      if(response.status!==200)throw Error(`GET ${response.status}`);
      const rows=parseHoShiftTemplates(await response.json(),scope(attempt.payload));
      if(!rows)throw Error("GET trả dữ liệu không hợp lệ");
      const candidates=rows.filter(row=>row.code===attempt.payload.code);
      this.state=candidates.length===0?"absent":candidates.length===1&&matches(attempt.payload,candidates[0])?"committed":"conflict";
    }catch(err){
      this.state="unknown";
      this.diagnostic+="; "+(err instanceof Error?err.message:"GET không khả dụng");
    }finally{this.inFlight=false;}
  }
}

export function createRecoveryMessage(recovery:HoCreateRecovery):string {
  switch(recovery.state){
    case "rejected":return "Core từ chối yêu cầu tạo. Kiểm tra quyền, dữ liệu hoặc mã trùng; chưa tạo mẫu ca từ yêu cầu này.";
    case "unknown":return "Chưa xác định yêu cầu đã được lưu hay chưa. Giữ nguyên bản nháp; kiểm tra từ Core trước khi gửi lại.";
    case "absent":return "Core chưa có mã này trong đúng phạm vi. Có thể thử lại cùng yêu cầu và khóa chống lặp; không đổi bản nháp.";
    case "conflict":return "Core có mã trùng nhưng dữ liệu khác hoặc nhiều bản ghi. Đã chặn tạo; liên hệ người quản lý để đối soát. Không gửi yêu cầu mới.";
    default:return "";
  }
}