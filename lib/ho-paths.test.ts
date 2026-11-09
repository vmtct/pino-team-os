/** PAP-1594 / PAP-1592 / Epic PAP-223 — HO-PATH-READ.
 * Contract tests for Founder-approved full-scope prototype G0 and SOP 05 V3.3.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapHoPaths } from "./ho-paths";
import { pathFields, pathQuery, pathDefinition } from "../app/ho/learning/paths/schema";

const rows = [
  { id: "01a03c6e-cc58-78f3-aa4f-3e9b3ac2afe2", code: "artchitect", displayName: "Artchitect", status: "ACTIVE" },
  { id: "01a03c6e-cc59-725c-a74b-efd1712cd555", code: "pianohouse", displayName: "PianoHouse", status: "ACTIVE" },
  { id: "01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c", code: "little-piner-art", displayName: "Little Piner Art", status: "ACTIVE" },
  { id: "01a03c6e-cc58-7175-bec5-b518313a1584", code: "little-piner-piano", displayName: "Little Piner Piano", status: "ACTIVE" },
];
const columns = ["name","code","group","status","createdAt","createdBy","updatedAt","updatedBy"];

test("PAP-1594 G0: eight Founder-approved fields mirror Table, Quick View and Detail", () => {
  assert.deepEqual(pathFields.map(field => field.key), columns);
  assert.deepEqual(pathQuery.visible, columns);
  assert.deepEqual(pathQuery.order, columns);
  assert.deepEqual(pathDefinition.drawer.sections[0]?.fields, columns);
  assert.deepEqual(pathDefinition.detail.overview.sections[0]?.fields, columns);
  assert.equal(pathDefinition.table.inlineEdit.enabled, false);
  assert.deepEqual(pathDefinition.drawer.actions, []);
  assert.deepEqual(pathDefinition.detail.businessTabs, []);
});

test("PAP-1594: four actual canonical records; fixture paths never displayed", () => {
  const mapped = mapHoPaths({ paths: [
    ...rows, { id: "01a0b961-ea78-72fe-99fe-ace24d24cd34", code: "pinoria-readiness-staging", displayName: "Test", status: "ACTIVE" },
    { id: "0199f001-0000-7000-8000-000000000002", code: "staging-delivery-syllabus", displayName: "Test", status: "ACTIVE" },
  ] });
  assert.equal(mapped.length, 4);
  assert.deepEqual(mapped.map(x => x.code).sort(), rows.map(x => x.code).sort());
  assert.equal(mapped.find(x => x.code === "artchitect")?.group, "Art");
  assert.equal(mapped.find(x => x.code === "pianohouse")?.group, "Music");
  assert.deepEqual([mapped[0]?.createdBy,mapped[0]?.updatedBy,mapped[0]?.createdAt,mapped[0]?.updatedAt], ["—","—","—","—"]);
});

test("PAP-1594: VN-local 24h Time displays DD/MM/YYYY · HH:mm; Core IDs unchanged", () => {
  const mapped=mapHoPaths({ paths:[{
    ...rows[0], createdAt:"2026-08-25T17:00:00Z", updatedAt:"2026-08-26T00:00:00Z",
  }] });
  assert.equal(mapped[0]?.id,rows[0]!.id);
  assert.equal(mapped[0]?.createdAt,"26/08/2026 · 00:00");
  assert.equal(mapped[0]?.updatedAt,"26/08/2026 · 07:00");
  // D1's unqualified SQLite UTC datetime must not be interpreted as browser local.
  assert.equal(mapHoPaths({paths:[{...rows[0],createdAt:"2026-08-25 17:00:00"}]})[0]?.createdAt,"26/08/2026 · 00:00");
});

test("PAP-1594: unverified displayName/email never accepted as CCCD legal actor; invalid dates unavailable",()=>{
  const m=mapHoPaths({paths:[{
    ...rows[0],createdAt:"not a date",updatedAt:null,
    createdByUserName:"Login Nickname",createdByEmail:"staff@example.invalid",updatedByUserName:"Nickname",
  }]});
  assert.deepEqual([m[0]?.createdAt,m[0]?.updatedAt,m[0]?.createdBy,m[0]?.updatedBy],["—","—","—","—"]);
});

test("PAP-1594: reject malformed canonical records, unknown codes, duplicates", () => {
  for(const invalid of [null,[],{paths:null},{paths:[{...rows[0],id:"bad"}]},{paths:[rows[0],rows[0]]}])
    assert.throws(()=>mapHoPaths(invalid));
  assert.deepEqual(mapHoPaths({paths:[{id:rows[0]!.id,code:"test-path",displayName:"Unknown",status:"ACTIVE"}]}),[]);
});
