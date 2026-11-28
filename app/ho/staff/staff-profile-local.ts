// PAP-2423 / PAP-784: isolated synthetic profile update, never live.
import {readPreviewRecord,reducePreview,type PreviewState} from "@/lib/m1-preview/state";
import type {StaffActivationFixture} from "./staff-activation-preview";
import {validateStaffDraft} from "./manual-create-contract";
import {staffPreviewCenter} from "./manual-create-preview";
export const staffProfileKeys=["name","phone","email","gender","birthDate"] as const;
export type StaffProfileKey=typeof staffProfileKeys[number];
export function commitStaffProfile(state:PreviewState<StaffActivationFixture>,id:string,revision:number,key:string,value:unknown){
 const r=readPreviewRecord(state,id);
 if(!r||!/^STAFF-MOCK-\d{3,}$/.test(id)||r.activationRevision!==revision||!staffProfileKeys.includes(key as StaffProfileKey)||typeof value!=="string"&&value!==null)return null;
 const draft={name:String(r.name??""),phone:String(r.phone??""),email:String(r.email??""),gender:String(r.gender??""),birthDate:String(r.birthDate??""),centerId:staffPreviewCenter.id,[key]:value??""};
 const validated=validateStaffDraft(draft,[staffPreviewCenter],null);
 if(!validated.ok)return null;
 const v=validated.command;
 if(!v.email.endsWith(".invalid")||state.records.some(x=>x.id!==id&&(x.phone===v.phone||x.email===v.email)))return null;
 const next={...r,name:v.name,phone:v.phone,email:v.email,gender:v.gender,birthDate:v.birthDate,activationRevision:revision+1};
 return reducePreview(state,{type:"replace",id,record:next});
}
