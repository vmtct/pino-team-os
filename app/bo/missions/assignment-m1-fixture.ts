/** PAP-2425 local synthetic data only. No fetch, storage, live IDs or real authority. */
import type { ModuleRow } from "@/lib/workspace-schema";
import { assignmentSubjectLabel, type AssignmentPresentation } from "./assignment-subject-presentation";
import type { ExpandedAssignmentFields } from "./assignment-expanded-schema";
export const ASSIGNMENT_M1_ROUTE="/bo/missions";
export const ASSIGNMENT_M1_ID="ASSIGNMENT-MOCK-001";
export const ASSIGNMENT_M1_CENTER="ASSIGNMENT-MOCK-CENTER";
export const staffAssignmentM1:AssignmentPresentation={
  category:"Staff Training",subject:{kind:"Staff",displayName:"Nhân sự mẫu"},status:"ASSIGNED",execution:"IN_PROGRESS",
};
export const staffAssignmentM1Row:ModuleRow<ExpandedAssignmentFields>={
  id:ASSIGNMENT_M1_ID,category:staffAssignmentM1.category,subjectKind:"Staff",student:assignmentSubjectLabel(staffAssignmentM1),
  name:"Hướng dẫn phối màu · mẫu",code:"MISSION-MOCK-001",status:"Đang giao",executionStatus:"Đang thực hiện",executionVersion:0,
  context:null,center:ASSIGNMENT_M1_CENTER,assignedAt:"2026-11-27T07:00:00.000Z",cancelledAt:null,cancelledReason:null,
  createdAt:"—",createdBy:"—",updatedAt:"—",updatedBy:"—",
};
