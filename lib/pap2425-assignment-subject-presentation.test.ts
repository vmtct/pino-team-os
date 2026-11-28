import assert from "node:assert/strict";
import { test } from "node:test";
import { assignmentCategoryOptions, assignmentPresentationScope, assignmentSubjectLabel, matchesAssignmentCategory, presentCategory, type AssignmentPresentation } from "../app/bo/missions/assignment-subject-presentation";

const staff: AssignmentPresentation = {
  category: "Staff Training", subject: { kind: "Staff", displayName: "Nhân sự mẫu" }, status: "ASSIGNED", execution: "IN_PROGRESS",
};
const student: AssignmentPresentation = {
  category: null, subject: { kind: "Student", displayName: "Học viên mẫu" }, status: "ASSIGNED", execution: "COMPLETED",
};

test("PAP-2425 preserves exact three catalog categories and unclassified legacy", () => {
  assert.deepEqual(assignmentCategoryOptions, ["Staff Training", "PINO Afterschool", "MyTime"]);
  assert.equal(presentCategory(null), null);
  assert.equal(presentCategory("staff training"), null);
  assert.equal(presentCategory("MyTime"), "MyTime");
  assert.equal(matchesAssignmentCategory(student, "UNCLASSIFIED"), true);
  assert.equal(matchesAssignmentCategory(student, "PINO Afterschool"), false);
  assert.equal(matchesAssignmentCategory(staff, "Staff Training"), true);
  assert.equal(matchesAssignmentCategory(staff, "ALL"), true);
});
test("PAP-2425 display uses authorized names only, never an ID fallback", () => {
  assert.equal(assignmentSubjectLabel(staff), "Nhân sự mẫu");
  assert.equal(assignmentSubjectLabel({...staff, subject:{kind:"Staff",displayName:null}}), "—");
});
test("PAP-2425 Staff does not expose Classroom Diary or Results; completion/reopen proposals follow execution", () => {
  assert.deepEqual(assignmentPresentationScope(staff), {classroom:false,staffTraining:true,showDiary:false,showResults:false,showCompletionProposal:true,showReopenProposal:false});
  assert.equal(assignmentPresentationScope({...staff,execution:"COMPLETED"}).showReopenProposal,true);
  assert.equal(assignmentPresentationScope({...staff,status:"CANCELLED"}).showCompletionProposal,false);
});
test("PAP-2425 legacy Student retains Classroom slots and existing Reopen proposal", () => {
  const scope=assignmentPresentationScope(student);
  assert.equal(scope.showDiary,true);
  assert.equal(scope.showResults,true);
  assert.equal(scope.showReopenProposal,true);
  assert.equal(scope.showCompletionProposal,false);
});
test("PAP-2425 unresolved MyTime and mismatched subject/category do not propose commands", () => {
  const mytime=assignmentPresentationScope({...staff,category:"MyTime",subject:{kind:"MyTime participant",displayName:null}});
  assert.deepEqual(mytime,{classroom:false,staffTraining:false,showDiary:false,showResults:false,showCompletionProposal:false,showReopenProposal:false});
  assert.equal(assignmentPresentationScope({...student,category:"Staff Training"}).showReopenProposal,false);
  assert.equal(assignmentPresentationScope({...staff,category:null}).showCompletionProposal,false);
});
