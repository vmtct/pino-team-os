import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatPinoDateTime } from "./pino-datetime";
test("PAP-2121 Opening Evidence displays the canonical ICT instant, including day rollover", () => {
  assert.equal(formatPinoDateTime("2026-11-17T18:20:00Z"), "18/11/2026 · 01:20");
  assert.equal(formatPinoDateTime("2026-11-18T01:20:00+07:00"), "18/11/2026 · 01:20");
  assert.equal(formatPinoDateTime("2026-11-18T01:20:00"), "—");
  assert.equal(formatPinoDateTime(null), "—");
});
test("PAP-2121 Classroom proof and Reception events reuse PINO_DATETIME_V1 without changing payloads", () => {
  const classroom = readFileSync(new URL("../app/components/tos-vnext/ClassroomV4Presentation.tsx", import.meta.url), "utf8");
  const reception = readFileSync(new URL("../app/components/tos-vnext/ReceptionV4OpenShift.tsx", import.meta.url), "utf8");
  for (const field of ["proofOpening.openedAt", "round.submittedAt", "photo.uploadedAt", "round.reviewedAt"]) {
    assert.ok(classroom.includes("{formatPinoDateTime(" + field + ")}"));
  }
  assert.ok(reception.includes("{formatPinoDateTime(e.occurredAt)}"));
  assert.ok(classroom.includes("dateLabel(d.at)"));
});
