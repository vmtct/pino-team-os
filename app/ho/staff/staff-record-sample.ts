// PAP-2430 / PAP-784: one ephemeral directory record; no storage or transport.
import {readPreviewRecord,reducePreview,type PreviewState} from "@/lib/m1-preview/state";
import {staffPreviewCenter} from "./manual-create-preview";
import type {StaffActivationFixture} from "./staff-activation-preview";
import type {AccountInlineSample} from "./staff-account-inline-sample";
import type {Snapshot,RoleChoice,CenterChoice} from "./staff-access-presentation-model";
export type StaffRecordSample=AccountInlineSample&{credential:"absent"|"present"|"unknown"};
export type StaffRecordAccess=Pick<Snapshot,"accountId"|"affiliationIds"|"assignments">&{credential:StaffRecordSample["credential"]};
export const extraSampleCenter={id:"M1-HYPOTHETICAL-CENTER",label:"Center M1 sample 2",active:true};
export function readStaffRecordSample(state:PreviewState<StaffActivationFixture>,id:string):StaffRecordSample|null{
 const r=readPreviewRecord(state,id);if(!r)return null;
 return {snapshot:{staffId:r.id,revision:r.activationRevision,employment:r.status==="Đang làm"?"active":"inactive",accountStatus:r.accountState??"missing",accountId:r.access?.accountId??null,affiliationIds:r.access?.affiliationIds??(r.center===staffPreviewCenter.label?[staffPreviewCenter.id]:[]),assignments:r.access?.assignments??[]},loginEmail:typeof r.loginEmail==="string"?r.loginEmail:"",credential:r.access?.credential??"unknown"};
}
export function commitStaffRecordSample(state:PreviewState<StaffActivationFixture>,before:StaffRecordSample,next:StaffRecordSample,roles:readonly RoleChoice[],centers:readonly CenterChoice[]):PreviewState<StaffActivationFixture>|null{
 const current=readStaffRecordSample(state,before.snapshot.staffId),r=readPreviewRecord(state,before.snapshot.staffId);
 if(!r||!current||JSON.stringify(current)!==JSON.stringify(before))return null;
 const b=before.snapshot,n=next.snapshot;
 if(n.staffId!==b.staffId||n.accountId!==b.accountId||n.employment!==b.employment||n.revision!==b.revision+1||!n.accountId||n.accountId!=="M1-HYPOTHETICAL-ACCOUNT:"+n.staffId||!/^STAFF-MOCK-\d{3,}$/.test(n.staffId)||b.assignments.some(a=>a.protected))return null;
 if(!["active","inactive"].includes(n.accountStatus)||!/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$/i.test(next.loginEmail)||!n.affiliationIds.length||new Set(n.affiliationIds).size!==n.affiliationIds.length||n.affiliationIds.some(id=>!centers.some(c=>c.id===id&&c.active)))return null;
 if(next.credential!==before.credential&&!(before.credential==="absent"&&next.credential==="present"&&b.employment==="active"&&b.accountStatus==="active"&&n.accountStatus===b.accountStatus&&next.loginEmail===before.loginEmail&&JSON.stringify(n.assignments)===JSON.stringify(b.assignments)&&JSON.stringify(n.affiliationIds)===JSON.stringify(b.affiliationIds)))return null;
 const role=n.assignments.map(a=>roles.find(x=>x.id===a.roleId)?.label??"Chưa xác minh").join("; ")||null;
 const center=n.affiliationIds.map(id=>centers.find(c=>c.id===id)!.label).join("; ");
 return reducePreview(state,{type:"replace",id:r.id,record:{...r,activationRevision:n.revision,accountState:n.accountStatus,loginEmail:next.loginEmail,role,center,access:{accountId:n.accountId,affiliationIds:n.affiliationIds,assignments:n.assignments,credential:next.credential}}});
}
