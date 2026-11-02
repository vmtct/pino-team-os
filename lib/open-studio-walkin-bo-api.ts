/** PAP-1092: Open Studio walk-in BO client only. Not imported by HO Staff or legacy BO API. */
export type WalkinPath = "AC" | "LPP" | "LPA" | "PH";
export type WalkinPass = {
 id:string;code:string;status:"AVAILABLE"|"ASSIGNED"|"CONSUMED"|"REVOKED";
 path_code:WalkinPath|null;parent_user_id:string|null;center_id:string|null;
};
export type WalkinPassEvent = {
 id:string;action:"ASSIGNED"|"CONSUMED"|"REVOKED";actor_user_id:string;
 center_id:string;path_code:WalkinPath|null;at:string;
};
export type VerifiedParentContact = {
 parentId:string;contactIdentifierId:string;parentName:string|null;maskedContact:string;lookupRequestId:string;
};
export type ParentCenterProof = {
 id:string;parent_user_id:string;center_id:string;verified_contact_id:string;
 method:"VERIFIED_CONTACT_ONSITE";verified_by_user_id:string;request_id:string;revoked_at:string|null;
};
async function read<T>(resource:string):Promise<T>{
 const response=await fetch("/api/bo/open-studio/walkin/"+resource,{cache:"no-store"});
 const data:unknown=await response.json();
 if(!response.ok||!data||typeof data!=="object"||!("data" in data))
  throw new Error("Open Studio Pass inventory unavailable");
 return (data as {data:T}).data;
}
async function write<T>(resource:"batches"|"assign"|"revoke"|"parent-contact-lookup"|"parent-center-proofs",payload:object):Promise<T>{
 const response=await fetch("/api/bo/open-studio/walkin/"+resource,{
  method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
  body:JSON.stringify(payload),cache:"no-store"
 });
 const data:unknown=await response.json();
 if(!response.ok||!data||typeof data!=="object"||!("data" in data))
  throw new Error("Open Studio Pass operation could not be completed; verify state before retrying");
 return (data as {data:T}).data;
}
export const walkinPassBoApi={
 inventory:(centerId?:string)=>read<WalkinPass[]>("inventory"+(centerId?"?centerId="+encodeURIComponent(centerId):"")),
 history:(passId:string,centerId:string)=>read<WalkinPassEvent[]>("history?"+new URLSearchParams({passId,centerId})),
 createBatch:(name:string,quantity:number)=>write<{id:string;name:string;quantity:number}>("batches",{name,quantity}),
 assign:(parentId:string,centerId:string,path:WalkinPath)=>write<WalkinPass>("assign",{parentId,centerId,path}),
 revoke:(passId:string,centerId:string)=>write<WalkinPass>("revoke",{passId,centerId}),
 recognizeVerifiedContact:(centerId:string,identifierType:"PHONE"|"EMAIL",contactValue:string)=>
  write<{candidate:VerifiedParentContact|null}>("parent-contact-lookup",{centerId,identifierType,contactValue}),
 verifyParentCenter:(candidate:VerifiedParentContact,centerId:string)=>
  write<ParentCenterProof>("parent-center-proofs",{
   parentId:candidate.parentId,centerId,contactIdentifierId:candidate.contactIdentifierId,
   requestId:candidate.lookupRequestId,confirmedContact:true
  })
};
