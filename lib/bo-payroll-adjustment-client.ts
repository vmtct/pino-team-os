import type {AdjustmentCommand} from "./bo-payroll-adjustment-confirmation";

/** PAP-1956: same-origin product client. No alternate route or automatic retry.
 * Kept unbound to runtime until exact product ingress is admitted.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FIXED_PERIOD="01a171ed-eb78-7941-b1de-dd4c020457b7";
const FIXED_STAFF="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
export function canSubmitPayrollAdjustmentScope(centerId:string,periodId:string,staffId:string){
 return [centerId,periodId,staffId].every(id=>ID.test(id))&&!(periodId===FIXED_PERIOD&&staffId===FIXED_STAFF);
}
export function adjustmentRequest(command:AdjustmentCommand){
 const {centerId,periodId,staffId,amountMinor,reason,expectedFingerprint,idempotencyKey}=command;
 const prefix="pay-adjust-"+expectedFingerprint+":";
 if(!canSubmitPayrollAdjustmentScope(centerId,periodId,staffId)||

   !Number.isSafeInteger(amountMinor)||amountMinor===0||Math.abs(amountMinor)>1_000_000_000_000||
   typeof reason!=="string"||reason!==reason.trim()||reason.length<3||reason.length>500||
   !/^[a-f0-9]{64}$/.test(expectedFingerprint)||!idempotencyKey.startsWith(prefix)||
   !/^[A-Za-z0-9-]{8,64}$/.test(idempotencyKey.slice(prefix.length)))throw Error("PAYROLL_ADJUSTMENT_COMMAND_INVALID");
 const path="/api/bo/workforce/payroll/periods/"+periodId+"/staff/"+staffId+"/adjustments?"+new URLSearchParams({centerId});
 const init:RequestInit={method:"POST",cache:"no-store",credentials:"same-origin",redirect:"error",
  headers:{"content-type":"application/json","idempotency-key":idempotencyKey},
  body:JSON.stringify({centerId,amountMinor,reason,expectedFingerprint})};
 return {path,init};
}
export async function submitPayrollAdjustment(command:AdjustmentCommand,transport:typeof fetch=fetch):Promise<unknown>{
 const {path,init}=adjustmentRequest(command);
 const response=await transport(path,init);
 if(response.status!==201)throw Error("PAYROLL_ADJUSTMENT_COMMAND_UNCONFIRMED");
 const body:unknown=await response.json();
 if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body)||!body.data||typeof body.data!=="object"||Array.isArray(body.data))throw Error("PAYROLL_ADJUSTMENT_COMMAND_UNCONFIRMED");
 return body.data;
}