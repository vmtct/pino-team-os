import test from "node:test";
import assert from "node:assert/strict";
import { assignmentDefinition, assignmentQuery, assignmentProvider } from "../app/bo/missions/schema";
import { formatMissionAuditTime, projectMissionC1History } from "./bo-mission-audit-projection";
import type { BoMissionCompletionEvent } from "./bo-mission-completion-client";

const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const record = "01a1bff7-0f2c-7940-a86b-f663343fee23";
const actor = "01a0b27b-0521-77c9-934d-b29aa6ec2e30";

const events: BoMissionCompletionEvent[] = [
  { id: "01a1c241-c52a-7cc2-9213-f783e23f44b2", centerId: center, assignmentId: record,
    action: "REOPEN", source: "BO", version: 2, statusBefore: "COMPLETED", statusAfter: "IN_PROGRESS",
    actorUserId: actor, reason: "Bổ sung phần luyện tập và hoàn thành lại.", occurredAt: "2026-11-10T02:32:00Z" },
  { id: "01a1c241-1ccc-7bbc-8000-f7851a62c729", centerId: center, assignmentId: record,
    action: "COMPLETE", source: "TOS", version: 1, statusBefore: "IN_PROGRESS", statusAfter: "COMPLETED",
    actorUserId: actor, reason: null, occurredAt: "2026-11-09T04:10:00Z" },
];

test("PAP-1792 S0-R3 audit selector: four typed, genuinely optional columns preserved in Drawer/Detail", () => {
  const keys = ["createdAt", "createdBy", "updatedAt", "updatedBy"];
  assert.deepEqual(keys.filter(key => assignmentDefinition.fields.some(field => field.key === key)), keys);
  for (const key of keys) {
    assert.ok(assignmentDefinition.table.columns.some(c => c.field === key && c.visible === false), key);
    assert.ok(!assignmentQuery.visible.includes(key as never), key);
    assert.ok(assignmentDefinition.drawer.sections.some(s => s.fields.includes(key as never)), key);
    assert.ok(assignmentDefinition.detail.overview.sections.some(s => s.fields.includes(key as never)), key);
  }
});

test("PAP-1792 S0-R3 Core C1 timeline is immutable, independently sourced, with no fabricated actor", () => {
  const result = projectMissionC1History(events, center, record);
  assert.equal(result.status, "authorized");
  if(result.status !== "authorized") return;
  assert.deepEqual(result.events.map(e => [e.action,e.actor,e.source]),[
    ["REOPEN","—","BO · C1"],["COMPLETE","—","TOS · C1"],
  ]);
  assert.ok(result.events[0]?.changes?.some(c => c.field === "reason" && c.after === events[0]!.reason));
  assert.ok(result.events[0]?.changes?.some(c => c.field === "executionStatus" && c.before === "Hoàn tất" && c.after === "Đang thực hiện"));
  assert.ok(result.events[0]?.changes?.some(c => c.field === "executionVersion" && c.after === 2));
  assert.equal(result.events[0]?.redacted,true);
  assert.equal(result.nextCursor,null);
});

test("PAP-1792 S0-R3 fail closed on Center/subject mismatch, never mix generic audit", () => {
  assert.throws(()=>projectMissionC1History(events,"00000000-0000-4000-8000-000000000000",record));
  assert.throws(()=>projectMissionC1History(events,center,"00000000-0000-4000-8000-000000000000"));
  assert.deepEqual(projectMissionC1History([],center,record),{status:"authorized",events:[],nextCursor:null});
});

test("PAP-1792 S0-R3 audit date is Vietnam local only and never uses assignment assignedAt as createdAt", () => {
  assert.equal(formatMissionAuditTime("2026-11-09T11:00:01.964Z"),"09/11/2026 · 18:00");
  assert.equal(formatMissionAuditTime(null),"—");
  assert.equal(formatMissionAuditTime("invalid"),"—");
});

test("PAP-1792 S0-R3 Manager BO source keeps createdBy and updatedBy redacted absent Core projection", async () => {
  const source={id:record,centerId:center,studentId:actor,missionId:actor,
    missionCodeSnapshot:"QA-TOS-ART-01",missionNameSnapshot:"Pha màu cơ bản",
    contextKey:"",contextLabel:null,status:"ASSIGNED",assignedAt:"2026-11-09T11:00:01Z",
    assignedByUserId:actor,updatedAt:"2026-11-09T11:00:01.964Z",updatedByUserId:actor,
    cancelledAt:null,cancelledReason:null,version:1};
  const fetcher:typeof fetch=async input => String(input).includes("/execution?")
    ? Response.json({data:{assignmentId:record,centerId:center,assignmentStatus:"ASSIGNED",
        executionStatus:"IN_PROGRESS",executionVersion:2,updatedAt:"2026-11-10T02:32:00Z",updatedByUserId:actor}})
    : Response.json({data:[source]});
  const result=await assignmentProvider.list(assignmentQuery,{surface:"BO",centerId:center},fetcher,new AbortController().signal);
  const fields=result.records[0]?.row as Record<string,unknown>;
  assert.equal(fields.createdAt,"—", "No verified Core createdAt must render literal em dash");
  assert.equal(fields.createdBy,"—", "No verified Core createdBy must render literal em dash");
  assert.equal(fields.updatedBy,"—", "No verified Core updatedBy must render literal em dash");
  assert.equal(fields.updatedAt,"09/11/2026 · 18:00");
  assert.equal(fields.assignedAt,source.assignedAt);
});
