/** PAP-1496 / PAP-1491 SPEC-UNLOCK — exact Subscription×Specialty Core DTO. */
export interface BoSubscriptionSpecialtyGrant {
 id:string;
 subscriptionId:string;
 specialtyId:string;
 effectiveFrom:string;
 completed:boolean;
 completedAt:string|null;
 completedByUserId:string|null;
 version:number;
 createdAt:string;
 createdByUserId:string;
 updatedAt:string;
 updatedByUserId:string;
}
export interface BoSubscriptionSpecialtyCatalogItem {
 id:string;name:string;pathProgramId:string;
 alreadyGranted:boolean;eligibleForNewGrant:boolean;missingPrerequisiteIds:string[];
}
export interface BoSubscriptionSpecialtyRead {
 subject:{
  id:string;centerId:string;studentProfileId:string;pathProgramId:string;
  lifecycle:string;serviceStartsOn:string|null;contractualEndsOn:string|null;
 };
 grants:BoSubscriptionSpecialtyGrant[];
 catalog:BoSubscriptionSpecialtyCatalogItem[];
}
