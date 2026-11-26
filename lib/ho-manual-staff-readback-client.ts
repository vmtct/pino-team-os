// PAP-2358 · WFM-STAFF. Unmounted historical operation readback.
import { HoManualStaffCreateError } from "./ho-manual-staff-create-client";
import { parseHoManualStaffReceipt, type HoManualStaffReceipt } from "./ho-manual-staff-create-receipt";
export type HoManualStaffReadback = {state:"NOT_OBSERVED"}|{state:"COMMITTED";receipt:HoManualStaffReceipt};
export async function readHoManualStaffReceipt(centerId:string,key:string,withLogin:boolean,
  options:{signal?:AbortSignal;fetcher?:typeof fetch}={}):Promise<HoManualStaffReadback>{
  if(withLogin||!/^[a-zA-Z0-9:_-]{8,120}$/.test(key))throw new HoManualStaffCreateError("invalid",400);
  let response:Response;
  try{
    response=await (options.fetcher??fetch)("/api/ho/staff/create/receipt",{
      method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
      headers:{"content-type":"application/json","idempotency-key":key},
      body:JSON.stringify({centerId}),...(options.signal?{signal:options.signal}:{}),
    });
  }catch{throw new HoManualStaffCreateError("uncertain",null);}
  if(response.status!==200)throw new HoManualStaffCreateError([401,403,404].includes(response.status)?"denied":"uncertain",response.status);
  const raw:unknown=await response.json().catch(()=>null);
  if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&Object.keys(raw).length===1&&"data" in raw){
    const data=raw.data;
    if(data&&typeof data==="object"&&!Array.isArray(data)&&"state" in data){
      if(data.state==="NOT_OBSERVED"&&Object.keys(data).length===1)return {state:"NOT_OBSERVED"};
      if(data.state==="COMMITTED"&&Object.keys(data).length===2&&"receipt" in data){
        const receipt=parseHoManualStaffReceipt({data:data.receipt},centerId,withLogin);
        if(receipt)return {state:"COMMITTED",receipt};
      }
    }
  }
  throw new HoManualStaffCreateError("uncertain",502);
}
