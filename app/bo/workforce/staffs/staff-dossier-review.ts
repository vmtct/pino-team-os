/** PAP-2411: proposed dossier review boundary; not a live BE approval contract. */
import type {BoStaffRegistrationRequest} from "@/lib/bo-model";
export type StaffDossierReviewRow=BoStaffRegistrationRequest&{createdAt?:string|null;createdBy?:string|null;updatedAt?:string|null;updatedBy?:string|null;reviewStage?:"REVIEWED_FOR_HO"|"REJECTED"|"HO_APPROVED"|"HO_REJECTED";reviewedVersion?:number;reviewedBy?:string;rejectReason?:string;finalizedStaffId?:string;hoRejectReason?:string};
export type StaffDossierReviewReceipt={registrationRequestId:string;centerId:string;status:"REVIEWED_FOR_HO";reviewedVersion:number;reviewedBy:string};
export type StaffDossierReviewPort={centerId:string;centerName:string;list?:()=>Promise<StaffDossierReviewRow[]>;submit?:(id:string,expectedVersion:number,centerId:string,key:string)=>Promise<StaffDossierReviewReceipt>};
