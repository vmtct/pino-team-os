import test from "node:test";
import assert from "node:assert/strict";
import { readCenterStudents, readActiveMissionChoices } from "./bo-mission-assignment-options";

const center = "01900000-0000-7000-8000-000000000001";
const student = "01900000-0000-7000-8000-000000000002";
const mission = "01900000-0000-7000-8000-000000000003";
const signal = new AbortController().signal;
const response = (data: unknown, status = 200) => Response.json({ data }, { status });
test("PAP-1210: learner search requires explicit Center and never falls back to global directory", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async input => { urls.push(String(input));
    return response([{ id: student, displayName: "Học viên A", status: "active", secret: "never projected" }]);
  };
  assert.deepEqual(await readCenterStudents(fetcher, center, "  ", signal), { items: [], refineSearch: true });
  assert.equal(urls.length, 0);
  assert.deepEqual(await readCenterStudents(fetcher, center, "Lan", signal),
    { items: [{ id: student, name: "Học viên A", status: "active" }], refineSearch: false });
  assert.equal(urls[0], "/api/bo/learners?centerId=" + center + "&query=Lan&limit=50");
  await assert.rejects(() => readCenterStudents(fetcher, "invalid", "Lan", signal));
  assert.equal(urls.length, 1);
});
test("PAP-1210: 50 learner matches require narrower query, never imply complete Center inventory", async () => {
  const fetcher: typeof fetch = async () => response(Array.from({ length: 50 }, (_, i) =>
    ({ id: "01900000-0000-7000-8000-" + (i + 10).toString().padStart(12, "0"),
       displayName: "Student " + i, status: "active" })));
  const result = await readCenterStudents(fetcher, center, "Student", signal);
  assert.equal(result.items.length, 50);
  assert.equal(result.refineSearch, true);
});
test("PAP-1210: only ACTIVE Core MissionDefinition can be selected; pagination full and bounded", async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async input => { urls.push(String(input));
    return response([{ id: mission, name: "Màu nước", code: "AC-01", status: "ACTIVE", level: 2 },
      { id: "01900000-0000-7000-8000-000000000004", name: "Đã khóa", code: "AC-02", status: "INACTIVE", level: 2 }]);
  };
  assert.deepEqual(await readActiveMissionChoices(fetcher, signal),
    [{ id: mission, name: "Màu nước", code: "AC-01", level: 2 }]);
  assert.deepEqual(urls, ["/api/bo/learning/missions?status=ACTIVE&limit=100&offset=0"]);
});
test("PAP-1210: wrong or duplicate identities, foreign response and denial fail closed", async () => {
  const malformed: typeof fetch = async () => response([{ id: "invalid", displayName: "Fake", status: "active" }]);
  await assert.rejects(() => readCenterStudents(malformed, center, "La", signal));
  const duplicates: typeof fetch = async () => response([
    { id: student, displayName: "A", status: "active" },
    { id: student, displayName: "B", status: "active" }]);
  await assert.rejects(() => readCenterStudents(duplicates, center, "La", signal));
  const inactive: typeof fetch = async () => response([{ id: mission, code: "XX", name: "Locked", level: 1, status: "INACTIVE" }]);
  assert.deepEqual(await readActiveMissionChoices(inactive, signal), []);
  const forbidden: typeof fetch = async () => response({}, 403);
  await assert.rejects(() => readActiveMissionChoices(forbidden, signal));
  await assert.rejects(() => readCenterStudents(forbidden, center, "La", signal));
  const malformedMission: typeof fetch = async () => response([{ id: mission, code: "xx", name: "Invalid", level: 9, status: "ACTIVE" }]);
  await assert.rejects(() => readActiveMissionChoices(malformedMission, signal));
});
test("PAP-1210: abort before parsing never recycles stale Center choices", async () => {
  const controller = new AbortController();controller.abort();
  const fetcher: typeof fetch = async () => response([{ id: mission, code: "AA", name: "Valid", level: 1, status: "ACTIVE" }]);
  await assert.rejects(() => readActiveMissionChoices(fetcher, controller.signal));
});
