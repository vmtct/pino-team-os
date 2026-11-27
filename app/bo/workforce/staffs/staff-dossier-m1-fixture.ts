import {createStaffRegistrationM1Service} from "./staff-registration-m1-service";
import {STAFF_DIRECTORY_MOCK_ID} from "./staff-directory-m1-fixture";
import type {StaffDossierReviewPort,StaffDossierReviewReceipt,StaffDossierReviewRow} from "./staff-dossier-review";
/** PAP-2411: BO reviews documents only; HO finalization is not emulated as an Access grant. */
export function createStaffDossierM1Fixture({completeDocuments=true}:{completeDocuments?:boolean}={}){
 const base=createStaffRegistrationM1Service({completeDocuments});
 const centerId="STAFF-MOCK-CENTER";
 let reviewed:StaffDossierReviewReceipt|null=null,terminalRow:StaffDossierReviewRow|null=null,busy=false;
 const receipts=new Map<string,{fingerprint:string;receipt:StaffDossierReviewReceipt}>();
 const dossierReview:StaffDossierReviewPort={centerId,centerName:"C\u1ea7n Th\u01a1 (M1)",list:async()=>terminalRow?[structuredClone(terminalRow)]:base.staffRegistrationRequests(),submit:async(id,version,center,key)=>{
  const fingerprint=JSON.stringify([id,version,center]);
  const prior=receipts.get(key);
  if(prior){if(prior.fingerprint!==fingerprint)throw Error("Conflicting fixture receipt");return structuredClone(prior.receipt);}
  if(busy||terminalRow||id!==STAFF_DIRECTORY_MOCK_ID||center!==centerId||!key.trim())throw Error("Invalid dossier review");
  busy=true;
  try {
   const row=(await base.staffRegistrationRequests()).find(r=>r.id===id);
   if(!row||row.version!==version||!row.documents.front||!row.documents.back)throw Error("Invalid dossier review");
   reviewed={registrationRequestId:id,centerId,status:"REVIEWED_FOR_HO",reviewedVersion:version,reviewedBy:"M1 BO Reviewer"};
   terminalRow={...row,reviewStage:"REVIEWED_FOR_HO",reviewedVersion:version,reviewedBy:"M1 BO Reviewer"};
   receipts.set(key,{fingerprint,receipt:reviewed});
   return structuredClone(reviewed);
  }finally{busy=false;}
 }};
 return {dossierReview,service:{...base,staffRegistrationRequests:async()=>reviewed?[]:base.staffRegistrationRequests(),approveStaffRegistration:async()=>{throw Error("HO finalization is not a BO command");},rejectStaffRegistration:async(...args:Parameters<typeof base.rejectStaffRegistration>)=>{
  if(reviewed||busy)throw Error("Dossier already reviewed or busy");
  busy=true;
  try {
   const [id,reason]=args;
   const row=(await base.staffRegistrationRequests()).find(r=>r.id===id);
   const result=await base.rejectStaffRegistration(...args);
   if(row)terminalRow={...row,reviewStage:"REJECTED",reviewedVersion:row.version,reviewedBy:"M1 BO Reviewer",rejectReason:reason.trim()};
   return result;
  }finally{busy=false;}
 }},readback:()=>structuredClone(reviewed)};
}
