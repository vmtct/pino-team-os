import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Day of Learning materializes bounded Visit, Attendance, Evidence, and correction commands", () => {
  const source = readFileSync(resolve(process.cwd(), "app/classroom/ClassroomView.tsx"), "utf8");
  assert.match(source, /tosDayOfLearningApi\.checkIn/);
  assert.match(source, /tosDayOfLearningApi\.checkOut/);
  assert.match(source, /tosDayOfLearningApi\.settle/);
  assert.match(source, /tosDayOfLearningApi\.correctAttendance/);
  assert.match(source, /Visit và Attendance là 2 truth riêng biệt/);
  assert.match(source, /Có mặt \+ Evidence/);
  assert.doesNotMatch(source, /PINO_BO_CORE|\/api\/bo\/|D1Database|NOTION/);
});

test("Day of Learning does not forge Learning Owner authority in the browser", () => {
  const api = readFileSync(resolve(process.cwd(), "lib/tos-day-of-learning-api.ts"), "utf8");
  assert.doesNotMatch(api, /learningOwnerStaffId/);
  assert.match(api, /idempotency-key/);
  assert.match(api, /students\/\$\{encodeURIComponent\(studentId\)\}\/visits\/open/);
  assert.match(api, /participation\/settle/);
  assert.match(api, /attendances\/\$\{encodeURIComponent\(input\.attendanceId\)\}\/correct/);
});


test("Classroom lesson-plan selection consumes only the exact Core-bound shared syllabus version", () => {
  const source = readFileSync(resolve(process.cwd(), "app/classroom/ClassroomView.tsx"), "utf8");
  const api = readFileSync(resolve(process.cwd(), "lib/tos-learning-api.ts"), "utf8");
  const start = source.indexOf("function boundLearningSyllabusVersion");
  const end = source.indexOf("function sourceLabel", start);
  assert.ok(start >= 0 && end > start);
  const selector = source.slice(start, end);
  assert.match(api, /learningSyllabusVersionId:string\|null/);
  assert.match(api, /learningSyllabusVersion:LearningSyllabusVersionProjection\|null/);
  assert.match(selector, /options\.learningSyllabusVersionId/);
  assert.match(selector, /options\.learningSyllabusVersion\.id === options\.learningSyllabusVersionId/);
  assert.doesNotMatch(selector, /primarySyllabusId|publicationStatus|syllabi\[0\]|syllabi\.find/);
  assert.doesNotMatch(source, /syllabusId:\s*lessonPlan/);
  assert.match(source, /syllabusId: legacyDiarySyllabusId/);
});
