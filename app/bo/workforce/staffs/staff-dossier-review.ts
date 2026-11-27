/** PAP-2411: proposed dossier review boundary; not a live BE approval contract. */
export type StaffDossierReviewReceipt={registrationRequestId:string;centerId:string;status:"REVIEWED_FOR_HO"};
export type StaffDossierReviewPort={centerId:string;centerName:string;submit?:(id:string,expectedVersion:number,centerId:string,key:string)=>Promise<StaffDossierReviewReceipt>};
