/** PAP-2411: proposed dossier review boundary; not a live BE approval contract. */
import type {BoStaffRegistrationRequest} from "@/lib/bo-model";
export type StaffDossierReviewRow=BoStaffRegistrationRequest&{reviewStage?:"REVIEWED_FOR_HO"|"REJECTED";reviewedVersion?:number;reviewedBy?:string;rejectReason?:string};
export type StaffDossierReviewReceipt={registrationRequestId:string;centerId:string;status:"REVIEWED_FOR_HO"};
export type StaffDossierReviewPort={centerId:string;centerName:string;list?:()=>Promise<StaffDossierReviewRow[]>;submit?:(id:string,expectedVersion:number,centerId:string,key:string)=>Promise<StaffDossierReviewReceipt>};
