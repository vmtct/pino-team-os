// PAP-1247 / PAP-784 / WFM-STAFF: exact local presentation admission only.
import type {ApprovalVerifier} from "@/lib/workspace-schema";
import {manualStaffDefinition} from "./manual-create-contract";
export const staffAccessApproval={jira:"PAP-784",owner:"WFM-STAFF",designAuthority:"Founder",
 files:["app/ho/staff/StaffAccessControls.tsx","app/ho/staff/StaffManualWorkspace.tsx","app/ho/staff/staff-access-admission.ts"],
 tests:["app/ho/staff/staff-access-admission.test.ts","app/ho/staff/staff-access-fixture-port.test.ts"],
 reviewBy:"2026-11-30T00:00:00+07:00"} as const;
export const staffAccessSlot={id:"access",label:"Access",kind:"approved-extension",
 source:{adapter:"staff.access.presentation",permission:"team.bo.access"},extensionId:"ho.staff.access",approval:staffAccessApproval} as const;
const exact=(actual:readonly string[],expected:readonly string[])=>actual.length===expected.length&&actual.every((v,i)=>v===expected[i]);
export const verifyStaffAccessApproval:ApprovalVerifier=(approval,scope)=>
 scope.surface==="HO"&&scope.key==="staffs"&&scope.extensionId===staffAccessSlot.extensionId&&
 approval.jira===staffAccessApproval.jira&&approval.owner===staffAccessApproval.owner&&
 approval.designAuthority===staffAccessApproval.designAuthority&&approval.reviewBy===staffAccessApproval.reviewBy&&
 exact(approval.files,staffAccessApproval.files)&&exact(approval.tests,staffAccessApproval.tests);
export const localStaffAccessDefinition={...manualStaffDefinition,detail:{...manualStaffDefinition.detail,
 businessTabs:[staffAccessSlot,...manualStaffDefinition.detail.businessTabs]}} as const;
// PAP-2347: exact local sample presentation, never registered by the live Staff schema.
export const staffRateSampleApproval={jira:"PAP-2347",owner:"WFM-STAFF",designAuthority:"Founder",
 files:["app/ho/staff/StaffRateSample.tsx","app/ho/staff/staff-rate-local-action.ts","scripts/native-m1-local/staff-entry.tsx"],
 tests:["app/ho/staff/staff-rate-local-action.test.ts","app/ho/staff/staff-access-admission.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00"} as const;
export const staffRateSampleSlot={id:"staff-rate",label:"Rate lương",kind:"approved-extension",source:{adapter:"salary.staff-rate.sample",permission:"team.bo.access"},extensionId:"ho.staff.rate.sample",approval:staffRateSampleApproval} as const;
export const verifyLocalStaffPreviewApproval:ApprovalVerifier=(approval,scope)=>verifyStaffAccessApproval(approval,scope)||
 (scope.surface==="HO"&&scope.key==="staffs"&&scope.extensionId===staffRateSampleSlot.extensionId&&approval.jira===staffRateSampleApproval.jira&&approval.owner===staffRateSampleApproval.owner&&approval.designAuthority===staffRateSampleApproval.designAuthority&&approval.reviewBy===staffRateSampleApproval.reviewBy&&exact(approval.files,staffRateSampleApproval.files)&&exact(approval.tests,staffRateSampleApproval.tests));
export const localStaffReviewDefinition={...localStaffAccessDefinition,detail:{...localStaffAccessDefinition.detail,businessTabs:[staffAccessSlot,staffRateSampleSlot]}} as const;
