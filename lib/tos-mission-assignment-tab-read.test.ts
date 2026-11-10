import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TosMissionAssignmentApiError, type TosMissionAssignmentRecord } from "./tos-mission-assignment-api";
import { V18bCoreError, type V18bClassroomToday } from "./tos-classroom-v18b-api";
import {
  readMissionAssignmentTab, startMissionAssignmentTabRead, missionTabReadMessage,
  type MissionTabScope, type MissionTabReadState,
} from "./tos-mission-assignment-tab-read";

const center = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const classroom = "33333333-3333-4333-8333-333333333333";
const mission = "44444444-4444-4444-8444-444444444444";
const assignment = "55555555-5555-4555-8555-555555555555";
const other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scope: MissionTabScope = { centerId: center, localDate: "2026-11-06",
  runningClassId: classroom, teachingContextKey: classroom + ":2026-11-06" };
function day(): V18bClassroomToday {
  return { centerId: center, localDate: scope.localDate, timeZone: "Asia/Ho_Chi_Minh",
    occurrences: [{ runningClassId: classroom, teachingContextKey: scope.teachingContextKey,
      operationalName: "Source class", rosterCoverage: "ENROLLMENTS_AND_GRACE_ONLY",
      occurrence: { occurrenceKey: scope.teachingContextKey, pathProgramId: mission,
        localDate: scope.localDate, status: "PROJECTED", localInterval: null },
      roster: [{ studentProfileId: student, studentDisplayName: "Core learner", status: "CANDIDATE",
        planned: true, includedManually: false, inclusionId: null, expectedSources: [] }] }],
    suppressed: [], diagnostics: [] };
}
function record(): TosMissionAssignmentRecord {
  return { id: assignment, centerId: center, studentId: student, missionId: mission,
    missionCodeSnapshot: "ART-101", missionNameSnapshot: "Persisted name",
    contextKey: scope.teachingContextKey, contextLabel: "Persisted context", status: "ASSIGNED",
    version: 3, assignedAt: "2026-11-06T01:00:00Z", assignedByUserId: other,
    updatedAt: "2026-11-06T02:00:00Z", updatedByUserId: other,
    cancelledAt: null, cancelledReason: null };
}
type Dependencies = NonNullable<Parameters<typeof readMissionAssignmentTab>[1]>;
function dependencies(source = day(), records = [record()]): Dependencies {
  const write = async (): Promise<never> => { throw Error("Unexpected writer"); };
  return { today: async (centerId, localDate) => {
    assert.equal(centerId, center); assert.equal(localDate, scope.localDate); return source;
  }, assignments: { list: async input => {
    assert.equal(input.studentId, student); assert.equal(input.teachingContextKey, scope.teachingContextKey);
    return records;
  }, create: write, updateContext: write, cancel: write } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("fresh Core day supplies candidate identity and persisted snapshots/status/version only", async () => {
  const source = day();
  source.occurrences[0]!.roster.push({ ...source.occurrences[0]!.roster[0]!,
    studentProfileId: other, studentDisplayName: "Conflict learner", status: "CONFLICT" });
  const result = await readMissionAssignmentTab(scope, dependencies(source));
  assert.equal(result.state, "READY");
  assert.deepEqual(result.groups, [{ studentId: student, studentName: "Core learner", cards: [{
    assignmentId: assignment, missionId: mission, missionCodeSnapshot: "ART-101",
    missionNameSnapshot: "Persisted name", status: "ASSIGNED", version: 3,
    contextLabel: "Persisted context", catalogLevel: null,
  }] }]);
  assert.doesNotMatch(JSON.stringify(result), /completed|plsValue|diaryId/);
});

test("confirmed empty list or actual empty roster is EMPTY; missing occurrence is unavailable", async () => {
  assert.equal((await readMissionAssignmentTab(scope, dependencies(day(), []))).state, "EMPTY");
  const empty = day(); empty.occurrences[0]!.roster = [];
  const api = dependencies(empty); api.assignments.list = async () => assert.fail("No candidate");
  assert.equal((await readMissionAssignmentTab(scope, api)).state, "EMPTY");
  empty.occurrences = [];
  await assert.rejects(readMissionAssignmentTab(scope, api));
});

test("wrong Center/date, non-PROJECTED, duplicate occurrence/roster and class mismatch fail before Assignment read", async () => {
  for (const alter of [
    (d: V18bClassroomToday) => { d.centerId = other; },
    (d: V18bClassroomToday) => { d.localDate = "2026-11-07"; },
    (d: V18bClassroomToday) => { d.occurrences[0]!.occurrence.status = "READY"; },
    (d: V18bClassroomToday) => { d.occurrences[0]!.runningClassId = other; },
    (d: V18bClassroomToday) => { d.occurrences.push(d.occurrences[0]!); },
    (d: V18bClassroomToday) => { d.occurrences[0]!.roster.push(d.occurrences[0]!.roster[0]!); },
  ]) {
    const source = day(); alter(source); const api = dependencies(source);
    api.assignments.list = async () => assert.fail("Scope must reject before list");
    await assert.rejects(readMissionAssignmentTab(scope, api), TosMissionAssignmentApiError);
  }
});

test("401/403 from day or Assignment propagate unchanged; UI messages hide raw diagnostics", async () => {
  for (const status of [401, 403]) for (const phase of ["day", "assignment"]) {
    const error = phase === "day" ? new V18bCoreError(status, "PRIVATE", "secret diagnostic")
      : new TosMissionAssignmentApiError(status, "PRIVATE", "secret diagnostic", { token: "secret" });
    const api = dependencies();
    if (phase === "day") api.today = async () => { throw error; };
    else api.assignments.list = async () => { throw error; };
    await assert.rejects(readMissionAssignmentTab(scope, api), e => e === error);
    assert.doesNotMatch(missionTabReadMessage(error), /secret|PRIVATE|token/);
  }
  assert.match(missionTabReadMessage({ status: 401 }), /đăng nhập/);
  assert.match(missionTabReadMessage({ status: 403 }), /quyền/);
  assert.match(missionTabReadMessage(Error("private")), /Chưa tải được/);
});

test("incomplete page, malformed snapshot or foreign record never becomes empty or partial success", async () => {
  for (const records of [Array.from({ length: 100 }, record),
    [{ ...record(), missionNameSnapshot: "" }], [{ ...record(), centerId: other }]]) {
    await assert.rejects(readMissionAssignmentTab(scope, dependencies(day(), records)));
  }
  const api = dependencies();
  api.assignments.list = async () => [{ ...record(), contextKey: other + ":2026-11-06" }];
  assert.equal((await readMissionAssignmentTab(scope, api)).state, "EMPTY");
});

test("a denied candidate hides the whole read, including already successful candidates", async () => {
  const source = day(); source.occurrences[0]!.roster.push({ ...source.occurrences[0]!.roster[0]!, studentProfileId: other });
  const api = dependencies(source), denied = new TosMissionAssignmentApiError(403, "DENIED", "private");
  api.assignments.list = async input => { if (input.studentId === other) throw denied; return [record()]; };
  const states: MissionTabReadState[] = [];
  startMissionAssignmentTabRead(scope, state => states.push(state), api);
  await flush();
  assert.deepEqual(states.map(state => state.state), ["LOADING", "UNAVAILABLE"]);
  assert.deepEqual(states[1]!.groups, []);
});

test("cleanup prevents late success/failure after Center switch or unmount; new reads start empty", async () => {
  for (const outcome of ["resolve", "reject"] as const) {
    const pending = deferred<V18bClassroomToday>(), old = dependencies(); old.today = () => pending.promise;
    old.assignments.list = async () => assert.fail("Discarded day must not launch Assignment reads");
    const states: MissionTabReadState[] = [];
    const cancel = startMissionAssignmentTabRead(scope, state => states.push(state), old);
    cancel();
    const newStates: MissionTabReadState[] = [];
    const newDay = day(); newDay.centerId = other; newDay.occurrences[0]!.roster = [];
    const next = dependencies(); next.today = async () => newDay;
    startMissionAssignmentTabRead({ ...scope, centerId: other }, state => newStates.push(state), next);
    if (outcome === "resolve") pending.resolve(day()); else pending.reject(new V18bCoreError(403, "DENIED", "private"));
    await flush();
    assert.deepEqual(states, [{ state: "LOADING", groups: [] }]);
    assert.deepEqual(newStates.map(state => state.state), ["LOADING", "EMPTY"]);
  }
});

test("an in-flight Assignment success or denial cannot publish after leaving the tab", async () => {
  for (const outcome of ["resolve", "reject"] as const) {
    const pending = deferred<TosMissionAssignmentRecord[]>(), api = dependencies();
    api.assignments.list = () => pending.promise;
    const states: MissionTabReadState[] = [];
    const cancel = startMissionAssignmentTabRead(scope, state => states.push(state), api);
    await flush(); cancel();
    if (outcome === "resolve") pending.resolve([record()]);
    else pending.reject(new TosMissionAssignmentApiError(403, "DENIED", "private"));
    await flush();
    assert.deepEqual(states, [{ state: "LOADING", groups: [] }]);
  }
});

test("PAP-1488: existing tab mounts approved Assignment card and shared sheet without Diary writer", () => {
  const parent=readFileSync("app/components/tos-vnext/ClassroomV4Presentation.tsx","utf8");
  const component=readFileSync("app/components/tos-vnext/MissionAssignmentTab.tsx","utf8");
  assert.match(parent,/import MissionAssignmentTab from "\.\/MissionAssignmentTab"/);
  assert.match(parent,/readOnly=\{readOnly\}/);
  assert.match(parent,/key=\{JSON.stringify\(\[model.centerId,model.today,current.runningClassId,current.id\]\)\}/);
  for (const name of ["missionBatch","missionBatchHead","missionCompactRow","missionCompactActions",
    "missionPrimaryCta","missionNextCta","missionSwapCta","scrim","sheet","missionChoice",
    "assignFooter"]) assert.ok(component.includes("styles."+name),name);
  assert.match(component,/createTosMissionAssignmentVerified/);
  assert.match(component,/replaceTosMissionAssignmentVerified/);
  assert.match(component,/disabled=\{!canWrite\}/);
  assert.match(component,/disabled=\{readOnly\|\|busy\|\|!!editor.old\}/);
  assert.doesNotMatch(component,/currentDiaries|DiaryMission|saveDiaryDraft|\.diaries\b/);
  assert.match(readFileSync("lib/tos-mission-assignment-api.ts","utf8"),
    /tosMissionAssignmentApi = createTosMissionAssignmentApiTransport\(false\)/);
});

test("PAP-1488: empty assigned list retains verified candidate for first Create, never fabricates Mission",async()=>{
  const result=await readMissionAssignmentTab(scope,dependencies(day(),[]));
  assert.equal(result.state,"EMPTY");
  assert.deepEqual(result.groups,[{studentId:student,studentName:"Core learner",cards:[]}]);
});