import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSpecialtyMissionSearch,
  searchLinkableSpecialtyMissions,
  type SpecialtyMissionOption,
} from "./specialty-mission-picker";

const art = "art-path", piano = "piano-path";
const missions: SpecialtyMissionOption[] = [
  { id: "m1", code: "QA-TOS-ART-01", name: "Vẽ vật thể 3D", pathProgramId: art, status: "ACTIVE", reconciliation: "READY" },
  { id: "m2", code: "QA-TOS-ART-02", name: "Nhận diện màu cơ bản", pathProgramId: art, status: "ACTIVE", reconciliation: "READY" },
  { id: "m3", code: "QA-TOS-ART-03", name: "Vẽ nước", pathProgramId: art, status: "INACTIVE", reconciliation: "READY" },
  { id: "m4", code: "QA-TOS-ART-04", name: "Vẽ chân dung", pathProgramId: art, status: "ACTIVE", reconciliation: "PENDING" },
  { id: "m5", code: "QA-TOS-PNO-01", name: "Vẽ phím piano", pathProgramId: piano, status: "ACTIVE", reconciliation: "READY" },
];
const linked = new Set(["m2"]);
const search = (q: string, path = art) => searchLinkableSpecialtyMissions(missions, path, linked, q);
test("PAP-1495 / SPEC-UNLOCK: no suggestions before 2 normalized characters", () => {
  assert.deepEqual(search(""), []);
  assert.deepEqual(search("v"), []);
  assert.deepEqual(search("  v  "), []);
  assert.deepEqual(search("ve").map(m => m.id), ["m1"]);
});
test("PAP-1495 / SPEC-UNLOCK: Vietnamese accent/case/đ and canonical Mission code search", () => {
  assert.equal(normalizeSpecialtyMissionSearch("ĐẶC ĐIỂM"), "dac diem");
  assert.deepEqual(search("VẼ").map(m => m.id), ["m1"]);
  assert.deepEqual(search("art-01").map(m => m.id), ["m1"]);
  assert.deepEqual(search("qa-tos-art-02"), []); // already linked
});
test("PAP-1495 / SPEC-UNLOCK: fail closed for other Path, inactive, pending, linked", () => {
  assert.deepEqual(search("ve").map(m => m.id), ["m1"]);
  assert.deepEqual(search("nước"), []);
  assert.deepEqual(search("chân"), []);
  assert.deepEqual(search("màu"), []);
  assert.deepEqual(search("piano"), []);
  assert.deepEqual(search("ve", ""), []);
});
test("PAP-1495 / SPEC-UNLOCK: results are new sorted references without mutating input", () => {
  const original = missions.map(m => m.id);
  assert.deepEqual(search("qa-tos-art-").map(m => m.id), ["m1"]);
  assert.deepEqual(missions.map(m => m.id), original);
  assert.deepEqual([...linked], ["m2"]);
});
