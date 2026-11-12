import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadMissionPathChoices, validateMissionSelectedPath } from "../app/ho/learning/missions/mission-path-options";
import { MissionCreateFields, emptyMission } from "../app/ho/learning/missions/MissionCreateFields";

const canonical = [
  { id: "019d9881-1025-7000-8000-000000000501", code: "artchitect", displayName: "Artchitect", status: "ACTIVE" },
  { id: "019d9881-1025-7000-8000-000000000502", code: "pianohouse", displayName: "PianoHouse", status: "ACTIVE" },
  { id: "019d9881-1025-7000-8000-000000000503", code: "little-piner-art", displayName: "Little Piner Art", status: "ACTIVE" },
  { id: "019d9881-1025-7000-8000-000000000504", code: "little-piner-piano", displayName: "Little Piner Piano", status: "ACTIVE" },
] as const;
function source(paths: readonly unknown[] = canonical, status = 200) {
  const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ data: paths }), {
      status, headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetcher, calls };
}
test("PAP-1207 S2 reads exactly four live ACTIVE Core Path identities, never local IDs", async () => {
  const { fetcher, calls } = source();
  const choices = await loadMissionPathChoices(fetcher);
  assert.equal(choices.length, 4);
  assert.deepEqual(new Set(choices.map(c => c.code)), new Set(canonical.map(c => c.code)));
  assert.deepEqual(new Set(choices.map(c => c.id)), new Set(canonical.map(c => c.id)));
  assert.deepEqual(choices.map(c => c.label), ["Artchitect", "Little Piner Art", "Little Piner Piano", "PianoHouse"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.input, "/api/ho/learning/paths");
  assert.equal(calls[0]!.init?.credentials, "same-origin");
  assert.equal(calls[0]!.init?.method, "GET");
  assert.equal(calls[0]!.init?.cache, "no-store");
  assert.equal(calls[0]!.init?.redirect, "error");
});
test("PAP-1207 S2 fails closed when Core denies, removes, deactivates, duplicates or renames any canon", async () => {
  const variants: { paths: readonly unknown[]; status?: number }[] = [
    { paths: canonical, status: 403 },
    { paths: canonical.slice(1) },
    { paths: [...canonical, canonical[0]] },
    { paths: canonical.map((p, i) => i === 0 ? { ...p, status: "INACTIVE" } : p) },
    { paths: canonical.map((p, i) => i === 0 ? { ...p, displayName: "Not verified" } : p) },
    { paths: canonical.map((p, i) => i === 0 ? { ...p, id: "not-a-uuid" } : p) },
    { paths: canonical.map((p, i) => i === 0 ? { ...p, code: "another-code" } : p) },
    { paths: canonical.map((p, i) => i === 0 ? { ...p, code: "pianohouse" } : p) },
  ];
  for (const { paths, status } of variants)
    await assert.rejects(loadMissionPathChoices(source(paths, status ?? 200).fetcher));
});
test("PAP-1207 S2 requires exact atomic source ID + code snapshot, never accepts manual or stale pair", async () => {
  const choices = await loadMissionPathChoices(source().fetcher);
  assert.match(validateMissionSelectedPath(emptyMission, choices) ?? "", /chọn Path/);
  assert.match(validateMissionSelectedPath({ pathProgramId: canonical[0].id, pathKeySnapshot: "pianohouse" }, choices) ?? "", /Path đã thay đổi/);
  assert.match(validateMissionSelectedPath({ pathProgramId: "019d9881-1025-7000-8000-000000000999", pathKeySnapshot: "artchitect" }, choices) ?? "", /Path đã thay đổi/);
  assert.match(validateMissionSelectedPath({ pathProgramId: canonical[0].id, pathKeySnapshot: "artchitect" }, []) ?? "", /Chưa xác minh/);
  assert.equal(validateMissionSelectedPath({ pathProgramId: canonical[0].id, pathKeySnapshot: "artchitect" }, choices), null);
});
test("PAP-1207 S2 Create Drawer has one Path picker, four real options, no paperSize/raw IDs, audit fields unverified", async () => {
  const options = await loadMissionPathChoices(source().fetcher);
  const html = renderToStaticMarkup(createElement(MissionCreateFields, {
    value: emptyMission, setValue: () => undefined, disabled: false, editing: false,
    pathChoices: options, pathState: "ready",
  }));
  assert.match(html, /<select[^>]*aria-label="Path"/);
  for (const x of ["Artchitect", "PianoHouse", "Little Piner Art", "Little Piner Piano"])
    assert.ok(html.includes(x), "missing "+x);
  assert.equal((html.match(/<select[^>]*aria-label="Path"/g) || []).length, 1);
  for (const hidden of ["Khổ giấy", "Program ID", "Snapshot", "Prerequisite Mission ID", "Prerequisite Code"])
    assert.ok(!html.includes(hidden), "unexpected field "+hidden);
  for (const audit of ["Created Time", "Created by (User)", "Last Modified Time", "Last Modified By (User)"])
    assert.ok(html.includes(audit), "missing audit field "+audit);
  assert.match(html, /value="—"/);
  assert.match(html, /value="ACTIVE"[^>]*selected/);
});
test("PAP-1207 S5 Edit supersedes old S2 legacy exposure, retains approved fields and hides Core links", async () => {
  const choices = await loadMissionPathChoices(source().fetcher);
  const html = renderToStaticMarkup(createElement(MissionCreateFields, {
    value: emptyMission, setValue: () => undefined, disabled: false, editing: true,
    pathChoices: choices, pathState: "ready",
  }));
  assert.match(html, /<select[^>]*aria-label="Path"/);
  for (const raw of ["Khổ giấy", "Prerequisite Mission ID", "Path Program ID", "Path Code Snapshot"])
    assert.doesNotMatch(html, new RegExp(raw));
  const status = html.match(/<span>Trạng thái<\/span>(.*?)<\/label>/)?.[1] ?? "";
  assert.match(status, /<input[^>]*readOnly/);
  assert.match(status, /disabled/);
  assert.doesNotMatch(html, /data-mission-create-audit/);
});

test("PAP-1207 S2 uses the original Dsa one-column edit-form / form-row CSS primitives", () => {
  const source = readFileSync("app/ho/learning/missions/MissionCreateFields.tsx", "utf8");
  const dsaCss = readFileSync("public/ho-authority-source/ho-scoped.css", "utf8");
  assert.match(source, /className="v25-form-fields edit-form"/);
  assert.match(source, /className="v25-form-metadata edit-form"/);
  assert.ok((source.match(/className="v25-form-field form-row"/g) ?? []).length >= 8);
  assert.doesNotMatch(source, /className="v25-form-field"/);
  assert.match(dsaCss, /\.edit-form\{display:flex;flex-direction:column;gap:16px/);
  assert.match(dsaCss, /\.form-row\{display:flex;flex-direction:column;gap:6px/);
});
test("PAP-1207 S3 canonical live HO Path envelope is data array and legacy nested is accepted", async () => {
  const live = source().fetcher;
  const rows = await loadMissionPathChoices(live);
  assert.equal(rows.length, 4);
  assert.equal(rows.find(x => x.code === "artchitect")?.id, canonical[0].id);
  const nested = (async () => Response.json({ data: { paths: canonical } })) as typeof fetch;
  assert.deepEqual(await loadMissionPathChoices(nested), rows);
  for (const value of [null, {wrong: canonical}, {data: "not-array"}, {data: {paths: "not-array"}}, {data: [canonical[0]]}]) {
    const malformed = (async () => Response.json(value)) as typeof fetch;
    await assert.rejects(loadMissionPathChoices(malformed));
  }
});