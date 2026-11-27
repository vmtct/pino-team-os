// PAP-2420: deterministic local receipt-to-directory projection, never a live writer.
import {reducePreview} from "@/lib/m1-preview/state";
import {newActivationPreview} from "./staff-activation-preview";
import {staffPreviewCenter} from "./manual-create-preview";
import {createFinalizationFixture,validReviewedDossier,type Dossier,type RoleOption,type FinalizationResult,type FinalizeRequest} from "./staff-registration-finalization-preview";
type State=ReturnType<typeof newActivationPreview>;
export function connectFinalizationDirectory(dossier:Dossier,roles:readonly RoleOption[],read:()=>State,write:(s:State)=>void){
 const staffId=()=>read().idPrefix+String(read().nextNumber).padStart(3,"0");
 const conflict=()=>read().records.some(row=>row.email===dossier.email||(dossier.mobile!==null&&row.phone===dossier.mobile));
 const fixture=createFinalizationFixture(dossier,roles,{identityConflict:conflict,nextStaffId:staffId});
 function finalize(request:FinalizeRequest):FinalizationResult{
 const previous=fixture.readback();
 const result=fixture.finalize(request);
 if(result.kind!=="approved"||previous)return result;
 const state=read(),r=result.receipt,role=roles.find(x=>x.id===r.roleId&&x.active);
 if(!validReviewedDossier(dossier)||!role||r.staffId!==staffId()||r.registrationRequestId!==dossier.id)throw Error("Invalid synthetic receipt");
 const next=reducePreview(state,{type:"create",record:{fixture:true,name:dossier.name,phone:dossier.mobile,email:dossier.email,gender:null,birthDate:null,center:staffPreviewCenter.label,status:"Ngưng",role:role.label,loginEmail:dossier.email,accountState:"unknown",activationRevision:1,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}});
 if(next.records.at(-1)?.id!==r.staffId)throw Error("Synthetic directory mismatch");write(next);return result;
 }
 return {fixture,finalize};
}
