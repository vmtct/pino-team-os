"use client";
/** PAP-2411 synthetic Staff directory presentation, no live transport. Caller provides admitted Center context. */
import type {BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {unifiedBoWorkspaceSource} from "@/app/bo/architecture/bo-unified-workspace-source";
import {StaffDirectoryWorkspace} from "@/app/bo/workforce/staffs/StaffDirectoryWorkspace";
import {staffDirectoryModule} from "@/app/bo/workforce/staffs/staff-directory-model";
import {STAFF_DIRECTORY_MOCK_ID} from "@/app/bo/workforce/staffs/staff-directory-m1-fixture";
import {createStaffLifecycleM1Fixture} from "@/app/bo/workforce/staffs/staff-lifecycle-m1-fixture";
import {StaffLifecycleDetail} from "@/app/bo/workforce/staffs/StaffLifecycleDetail";
import {createStaffM1KeyFactory} from "@/app/bo/workforce/staffs/staff-registration-m1-service";
import {createStaffDossierM1Fixture} from "@/app/bo/workforce/staffs/staff-dossier-m1-fixture";
import {StaffRegistrationReviewQueue} from "@/app/bo/staff/StaffRegistrationReviewQueue";
import {StaffRegistrationIntakeToggle} from "@/app/bo/staff/StaffRegistrationIntakeToggle";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
export const STAFF_REVIEW_CENTER_ID="STAFF-MOCK-CENTER";
export function createBoStaffReviewController(){
const route="/bo/workforce/staffs",centerId=STAFF_REVIEW_CENTER_ID;
const {service,dossierReview}=createStaffDossierM1Fixture(),newKey=createStaffM1KeyFactory(),lifecycle=createStaffLifecycleM1Fixture();
const source:BoWorkspaceSource={ephemeral:true,readOnly:true,modules:{...unifiedBoWorkspaceSource.modules,staffs:staffDirectoryModule},routeForModule:key=>key==="staffs"?route:"#unavailable-local-module",scopeLabel:()=>"M1 - D\u1eef li\u1ec7u m\u1eabu",load:async(key,_fetcher,options)=>{if(key!=="staffs"||options.centerId!==centerId)throw Error("Unknown local fixture scope");return lifecycle.rows();},staffDetailReview:(record,options)=>options.centerId===centerId&&record.id===STAFF_DIRECTORY_MOCK_ID?<StaffLifecycleDetail key={record.id} fixture={{snapshot:lifecycle.snapshot,rows:lifecycle.rows}} recordId={record.id} centerName={dossierReview.centerName}/>:undefined};
return {source,service,newKey,dossierReview};
}
export type BoStaffReviewController=ReturnType<typeof createBoStaffReviewController>;
export function BoStaffReviewContent({controller,view}:{controller:BoStaffReviewController;view:string}){const {source,service,newKey,dossierReview}=controller;return <TddPreferencePolicy.Provider value="ephemeral"><StaffDirectoryWorkspace source={source} currentUser={{displayName:"M1 - D\u1eef li\u1ec7u m\u1eabu"}} options={{view}} centerId={STAFF_REVIEW_CENTER_ID} registration={<><StaffRegistrationIntakeToggle service={service}/><StaffRegistrationReviewQueue service={service} newKey={newKey} dossierReview={dossierReview}/></>}/></TddPreferencePolicy.Provider>;}
