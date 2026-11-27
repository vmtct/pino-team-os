import type {StaffDossierReviewReceipt,StaffDossierReviewRow} from "./staff-dossier-review";
/** PAP-2411 / PAP-2420 presentation contract. Only a verified HO read adapter may supply this result; never a BO command. */
export type StaffHoDecisionReadback=
 |{kind:"approved";receipt:{registrationRequestId:string;status:"APPROVED";reviewedVersion:number;personId:string;staffId:string;userId:string;roleId:string;scopeType:"CENTER"|"GLOBAL";scopeId:string|null;employmentStatus:"inactive";operationalReadiness:"unverified";fixture:true}}
 |{kind:"rejected";registrationRequestId:string;reviewedVersion:number;reason:string}
 |{kind:"stale"|"denied"|"conflict"|"invalid"};
export function projectStaffHoDecision(row:StaffDossierReviewRow,boReceipt:StaffDossierReviewReceipt,decision:StaffHoDecisionReadback):StaffDossierReviewRow{
 if(row.reviewStage!=="REVIEWED_FOR_HO"||boReceipt.status!=="REVIEWED_FOR_HO"||row.id!==boReceipt.registrationRequestId||row.version!==boReceipt.reviewedVersion||row.reviewedVersion!==boReceipt.reviewedVersion||row.reviewedBy!==boReceipt.reviewedBy||!boReceipt.centerId.trim()||!boReceipt.reviewedBy.trim())throw Error("Invalid BO-reviewed dossier");
 if(decision.kind==="approved"){
  const r=decision.receipt;
  if(r.registrationRequestId!==row.id||r.reviewedVersion!==row.version||r.status!=="APPROVED"||r.fixture!==true||r.employmentStatus!=="inactive"||r.operationalReadiness!=="unverified"||[r.personId,r.staffId,r.userId,r.roleId].some(v=>typeof v!=="string"||!v.trim())||r.staffId===row.id||!((r.scopeType==="CENTER"&&r.scopeId===boReceipt.centerId)||(r.scopeType==="GLOBAL"&&r.scopeId===null)))throw Error("Invalid HO approval readback");
  return {...row,reviewStage:"HO_APPROVED",finalizedStaffId:r.staffId};
 }
 if(decision.kind==="rejected"){
  if(decision.registrationRequestId!==row.id||decision.reviewedVersion!==row.version||!decision.reason.trim()||decision.reason.trim().length>500)throw Error("Invalid HO rejection readback");
  return {...row,reviewStage:"HO_REJECTED",hoRejectReason:decision.reason.trim()};
 }
 throw Error("No confirmed HO decision");
}
