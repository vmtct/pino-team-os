import { test, expect } from "@playwright/test";

const staffId = "0198d050-56c1-7ac5-b9ab-b0e45d910001";
const assignmentId = "0198d050-56c1-7ac5-b9ab-b0e45d910002";
const moduleId = "0198d050-56c1-7ac5-b9ab-b0e45d910003";
const versionId = "0198d050-56c1-7ac5-b9ab-b0e45d910004";
const qualificationId = "0198d050-56c1-7ac5-b9ab-b0e45d910005";
const now = "2026-09-02T14:00:00.000Z";

const version = {
  id: versionId, moduleId, versionNumber: 1, status: "PUBLISHED" as const,
  title: "Classroom Diary & Closing", summary: "Runtime Core projection", track: "MENTOR",
  lessons: [{ key: "closing", title: "Closing checklist", kind: "CHECKLIST" as const, estimatedMinutes: 8 }],
  assessmentThreshold: null, requiresSignoff: false, qualificationCode: "CLASSROOM_OPERATOR", policyReference: null,
  revision: 1, publishedAt: now, createdAt: now, updatedAt: now,
};test("canonical TOS Training consumes Core projection and writes lesson progress", async ({ page }) => {
  let completed = false;
  await page.route("**/api/workforce/training/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const assignment = {
      id: assignmentId, staffMemberId: staffId, moduleVersionId: versionId,
      status: completed ? "COMPLETED" as const : "ASSIGNED" as const,
      dueDate: null, assignmentReason: "Required", assignedAt: now,
      completedAt: completed ? now : null, updatedAt: now,
    };
    const qualification = completed ? {
      id: qualificationId, staffMemberId: staffId, qualificationCode: "CLASSROOM_OPERATOR",
      sourceAssignmentId: assignmentId, status: "ACTIVE" as const, grantedAt: now, expiresAt: null,
    } : null;
    const detail = { assignment, version, completedLessonKeys: completed ? ["closing"] : [], latestAssessment: null, signOff: null, qualification };
    if (request.method() === "GET" && path.endsWith("/training/self")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { assignments: [detail], qualifications: qualification ? [qualification] : [] } }) });
    }
    if (request.method() === "POST" && path.endsWith(`/assignments/${assignmentId}/lessons/complete`)) {
      completed = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: detail }) });
    }
    return route.abort();
  });
  await page.goto("/training");
  await expect(page.getByRole("heading", { name: "Skill Passport" })).toBeVisible();
  await expect(page.getByText("Classroom Diary & Closing", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa bắt đầu", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tiếp tục học" }).click();
  await expect(page.getByText("Đã đạt", { exact: true })).toBeVisible();
  await expect(page.getByText("CLASSROOM_OPERATOR", { exact: true })).toBeVisible();
  await expect(page.getByText("● VERIFIED", { exact: true })).toBeVisible();
});
