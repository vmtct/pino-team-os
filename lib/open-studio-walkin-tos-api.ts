/** PAP-1092: separate TOS walk-in Pass client, not a Classroom read API. */
export type WalkinTosPass = {
 id:string;code:string;status:"AVAILABLE"|"ASSIGNED"|"CONSUMED"|"REVOKED";
 path_code:"AC"|"LPP"|"LPA"|"PH"|null;parent_user_id:string|null;
};
export type EPassEvidenceReceipt={
 receiptId:string;passId:string;centerId:string;status:"STORED";
 mimeType:"image/jpeg"|"image/png"|"image/webp";byteSize:number;createdAt:string;
};
export interface WalkinLookup{
 pass:WalkinTosPass;parentName:string|null;students:Array<{id:string;name:string}>;
}
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch("/api/tos-learning/open-studio/walkin/"+path,{
  cache:"no-store",...init,headers:{...(init.body?{"content-type":"application/json"}:{}),...init.headers}
 });
 const body:unknown=await response.json();
 if(!response.ok||!body||typeof body!=="object"||!("data" in body))
  throw new Error("Không thể xử lý Pass Trạm Nghệ Thuật.");
 return (body as {data:T}).data;
}
export const walkinPassTosApi={
 storeEvidence:(data:{
  centerId:string;code:string;mimeType:string;base64:string;capturedWithConsent:true;
 })=>request<EPassEvidenceReceipt>("evidence",{
  method:"POST",body:JSON.stringify(data),headers:{"idempotency-key":crypto.randomUUID()}
 }),
 lookup:(centerId:string,code:string)=>request<WalkinLookup>(
  "lookup?"+new URLSearchParams({centerId,code})
 ),
 consume:(data:{
  centerId:string;code:string;shiftId?:string|null;confirmedHolder:true;evidenceReceiptId:string;
  studentId?:string|null;manualChildName?:string|null;
 })=>request<{id:string;status:"CONSUMED";child_name:string;student_id:string|null}>(
  "consume",{method:"POST",headers:{"idempotency-key":crypto.randomUUID()},body:JSON.stringify(data)}
 )
};
