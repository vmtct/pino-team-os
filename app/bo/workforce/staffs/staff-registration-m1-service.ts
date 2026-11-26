import type {StaffRegistrationReviewService} from "../../staff/StaffRegistrationReviewQueue";
import type {StaffRegistrationIntakeService} from "../../staff/StaffRegistrationIntakeToggle";
import type {BoStaffRegistrationRequest,BoStaffRegistrationApprovalResult} from "@/lib/bo-model";
import {STAFF_DIRECTORY_MOCK_ID} from "./staff-directory-m1-fixture";
/** Local fixture keys are per-instance and never used by live commands. */
export function createStaffM1KeyFactory(){let sequence=0;return ()=>"M1-STAFF-REVIEW-"+(++sequence);}
/** PAP-2411 local synthetic service: no network, storage, authentication or real account provisioning. */
export function createStaffRegistrationM1Service():StaffRegistrationReviewService&StaffRegistrationIntakeService {
  const centerId="STAFF-MOCK-CENTER",roleId="STAFF-MOCK-ROLE";
  const submittedAt="2026-11-26T08:00:00.000Z";
  const seed:BoStaffRegistrationRequest={id:STAFF_DIRECTORY_MOCK_ID,status:"PENDING",displayLabel:"Nh\u00e2n s\u1ef1 m\u1eabu PINO",email:"staff@example.invalid",mobile:null,governmentIdLast4:"0000",bankAccountLast4:"0000",documents:{front:false,back:false},submittedAt,version:1};
  let pending=true,enabled=true,version=1;
  const receipts=new Map<string,{fingerprint:string;receipt:BoStaffRegistrationApprovalResult|{registrationRequestId:string;status:"REJECTED"}}>();
  const state=()=>({enabled,updatedAt:submittedAt,updatedByUserId:null,version});
  return {
    staffRegistrationIntake:async()=>state(),setStaffRegistrationIntake:async next=>{enabled=next;version++;return state();},
    staffRegistrationRequests:async()=>pending?[structuredClone(seed)]:[],
    accessRoles:async()=>[{id:roleId,roleKey:"staff",displayName:"Staff (M1)",roleType:"custom",status:"active",description:null,permissionCount:0,assignmentCount:0}],
    scopeCatalog:async()=>({centers:[{id:centerId,key:"m1",displayName:"C\u1ea7n Th\u01a1 (M1)",timeZone:"Asia/Ho_Chi_Minh",status:"active"}],paths:[],classes:[]}),
    staffRecords:async()=>[],accessUsers:async()=>[],learners:async()=>[],
    approveStaffRegistration:async(id,assignments,identity,key,existing)=>{
      const fingerprint=JSON.stringify([id,assignments,identity,existing??null]);
      const prior=receipts.get(key);
      if(prior){if(prior.fingerprint!==fingerprint||prior.receipt.status!=="APPROVED")throw Error("Fixture receipt conflict");return structuredClone(prior.receipt);}
      if(!pending||id!==seed.id||existing||identity.mode!=="CREATE_STAFF_ONLY_PERSON"||!assignments.length||assignments.some(a=>a.roleId!==roleId||!((a.scopeType==="GLOBAL"&&a.scopeId===null)||(a.scopeType==="CENTER"&&a.scopeId===centerId))))throw Error("Invalid fixture review");
      const receipt:BoStaffRegistrationApprovalResult={registrationRequestId:id,status:"APPROVED",staffMemberId:STAFF_DIRECTORY_MOCK_ID,userId:"M1-NOT-A-REAL-ACCOUNT",assignmentIds:[],accessState:"PROVISIONED_PASSWORD_READY",authenticationMethod:"LOCAL_PASSWORD"};
      pending=false;receipts.set(key,{fingerprint,receipt});return structuredClone(receipt);
    },
    rejectStaffRegistration:async(id,reason,key)=>{
      const fingerprint=JSON.stringify([id,reason]);const prior=receipts.get(key);
      if(prior){if(prior.fingerprint!==fingerprint||prior.receipt.status!=="REJECTED")throw Error("Fixture receipt conflict");return structuredClone(prior.receipt);}
      if(!pending||id!==seed.id||!reason.trim())throw Error("Invalid fixture review");
      const receipt={registrationRequestId:id,status:"REJECTED" as const};pending=false;receipts.set(key,{fingerprint,receipt});return {...receipt};
    },
  };
}
