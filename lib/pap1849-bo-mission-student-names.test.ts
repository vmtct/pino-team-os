import test from "node:test";
import assert from "node:assert/strict";
import { readAuthorizedMissionStudentNames } from "./bo-mission-student-names";
import { assignmentFields, assignmentProvider, assignmentQuery } from "../app/bo/missions/schema";

const center = "01900000-0000-7000-8000-000000000001";
const student = "01900000-0000-7000-8000-000000000002";
const other = "01900000-0000-7000-8000-000000000003";
const signal = () => new AbortController().signal;

test("PAP-1849 Student names are sourced through Center-scoped, same-origin BO learners", async () => {
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    paths.push(String(input));
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.redirect, "error");
    return Response.json({ data: [
      { id: student, displayName: "  Nguyễn An  " },
      { id: other, displayName: "  " },
    ] });
  };
  const names = await readAuthorizedMissionStudentNames(fetcher, center, signal());
  assert.deepEqual(paths, ["/api/bo/learners?limit=100&centerId=" + center]);
  assert.equal(names.get(student), "Nguyễn An");
  assert.equal(names.get(other), undefined);
});

test("PAP-1849 directory is bounded and paged by canonical student cursor", async () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    id: "01900000-0000-7000-8000-" + String(index + 100).padStart(12, "0"),
    displayName: "Học viên " + (index + 1),
  }));
  const paths: string[] = [];
  const fetcher: typeof fetch = async input => {
    paths.push(String(input));
    return Response.json({ data: paths.length === 1 ? records : [{ id: student, displayName: "Minh" }] });
  };
  const names = await readAuthorizedMissionStudentNames(fetcher, center, signal());
  assert.equal(names.size, 101);
  assert.equal(paths.length, 2);
  assert.equal(new URL("https://bo.invalid" + paths[1]).searchParams.get("beforeStudentId"), records.at(-1)?.id);
  assert.ok(paths.every(x => x.includes("centerId=" + center)));
});

test("PAP-1849 permission denial, invalid response and aborted read never fabricate a Student name", async () => {
  const denied: typeof fetch = async () => Response.json({ error: "denied" }, { status: 403 });
  await assert.rejects(readAuthorizedMissionStudentNames(denied, center, signal()));
  await assert.rejects(readAuthorizedMissionStudentNames(async () => Response.json({ data: [{ id: "wrong", displayName: "Bad" }] }), center, signal()));
  await assert.rejects(readAuthorizedMissionStudentNames(async () => Response.json({ data: [] }), "invalid", signal()));
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(readAuthorizedMissionStudentNames(async () => Response.json({ data: [] }), center, aborted.signal));
});

test("PAP-1849 BO Mission DSA exposes Student label and never raw internal ID fields", () => {
  assert.equal(assignmentFields.find(f => f.key === "student")?.label, "Student");
  assert.equal(assignmentFields.some(f => /(?:Student|Center|Mission) ID|Context Key/.test(f.label)), false);
  assert.deepEqual(assignmentQuery.visible.includes("student"), true);
  const internalCenter = assignmentFields.find(f => f.key === "center");
  assert.equal(internalCenter?.capabilities.display, false);
  assert.equal(assignmentQuery.order.includes("center"), false);
  assert.equal(assignmentProvider.mutation, undefined);
});
