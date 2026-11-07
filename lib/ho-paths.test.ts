import assert from "node:assert/strict";
import test from "node:test";
import { mapHoPaths } from "./ho-paths";

const rows = [
  { id: "01a03c6e-cc58-78f3-aa4f-3e9b3ac2afe2", code: "artchitect", displayName: "Artchitect", status: "ACTIVE" },
  { id: "01a03c6e-cc59-725c-a74b-efd1712cd555", code: "pianohouse", displayName: "PianoHouse", status: "ACTIVE" },
  { id: "01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c", code: "little-piner-art", displayName: "Little Piner Art", status: "ACTIVE" },
  { id: "01a03c6e-cc58-7175-bec5-b518313a1584", code: "little-piner-piano", displayName: "Little Piner Piano", status: "ACTIVE" },
];
test("PAP-1594: four actual canonical records; fixture paths never displayed", () => {
  const mapped = mapHoPaths({ paths: [
    ...rows, { id: "01a0b961-ea78-72fe-99fe-ace24d24cd34", code: "pinoria-readiness-staging", displayName: "Test", status: "ACTIVE" },
    { id: "0199f001-0000-7000-8000-000000000002", code: "staging-delivery-syllabus", displayName: "Test", status: "ACTIVE" },
  ] });
  assert.equal(mapped.length, 4);
  assert.deepEqual(mapped.map(x => x.code).sort(), rows.map(x => x.code).sort());
  assert.equal(mapped.find(x => x.code === "artchitect")?.group, "Art");
  assert.equal(mapped.find(x => x.code === "pianohouse")?.group, "Music");
  assert.equal(mapped[0]?.createdBy, "—");
  assert.equal(mapped[0]?.createdAt, "—");
});
test("PAP-1594: trust real Core identity and metadata, never generate a Path", () => {
  const mapped = mapHoPaths({ paths: [{ ...rows[0], createdAt: "2026-08-26T00:00:00Z", createdByUserName: "Core Actor" }] });
  assert.equal(mapped[0]?.id, rows[0]!.id);
  assert.equal(mapped[0]?.createdAt, "2026-08-26T00:00:00Z");
  assert.equal(mapped[0]?.createdBy, "Core Actor");
  for (const invalid of [null, [], { paths: null }, { paths: [{ ...rows[0], id: "false" }] }, { paths: [rows[0], rows[0]] }])
    assert.throws(() => mapHoPaths(invalid));
});
test("PAP-1594: cannot expose unknown Path as a canon even when ACTIVE", () => {
  assert.deepEqual(mapHoPaths({ paths: [{ id: rows[0]!.id, code: "test-path", displayName: "Unknown", status: "ACTIVE" }] }), []);
});
