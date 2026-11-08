import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionCreateFields, emptyMission } from "../app/ho/learning/missions/MissionCreateFields";
import { validateMissionSelectedPath, type MissionPathChoice } from "../app/ho/learning/missions/mission-path-options";
import type { MissionInput } from "../app/ho/learning/missions/command";

/** PAP-1188 / MISSION, PAP-1207 S5: valid Core-like ID fixtures; no HTTP or writes. */
const paths: readonly MissionPathChoice[] = [
  { id: "01900000-0000-7000-8000-000000000001", code: "artchitect", label: "Artchitect" },
  { id: "01900000-0000-7000-8000-000000000002", code: "pianohouse", label: "PianoHouse" },
  { id: "01900000-0000-7000-8000-000000000003", code: "little-piner-art", label: "Little Piner Art" },
  { id: "01900000-0000-7000-8000-000000000004", code: "little-piner-piano", label: "Little Piner Piano" },
];
const sourceDraft: MissionInput = {
  ...emptyMission, name: "Mori", code: "MORI-1",
  pathProgramId: paths[0]!.id, pathKeySnapshot: paths[0]!.code,
  paperSize: "A4", prerequisiteMissionId: "01900000-0000-7000-8000-000000000009",
  prerequisiteCodeSnapshot: "BEFORE-1",
};

test("PAP-1207 S5 Edit shows only approved eight business fields and never raw soft references", () => {
  const html = renderToStaticMarkup(MissionCreateFields({
    value: sourceDraft, setValue: () => undefined, disabled: false, editing: true,
    pathChoices: paths, pathState: "ready",
  }));
  assert.match(html, /aria-label="Thông tin sửa Mission"/);
  for (const expected of ["Nhiệm vụ *", "Mã *", "Cấp độ", "Trạng thái", "PLS", "Path *", "Mô tả", "Hướng dẫn"]) {
    assert.ok(html.includes("<span>" + expected + "</span>"), "missing field " + expected);
  }
  assert.equal((html.match(/class="v25-form-field form-row"/g) ?? []).length, 8);
  assert.doesNotMatch(html, /Khổ giấy|Program ID|Snapshot|Prerequisite|Mission ID|UUID/);
  const status = html.match(/<span>Trạng thái<\/span>(.*?)<\/label>/)?.[1] ?? "";
  assert.match(status, /<input[^>]*read[oO]nly/);
  assert.match(status, /disabled/);
  assert.doesNotMatch(status, /<select|onChange/);
  assert.match(html, /aria-label="Path"/);
  assert.ok(paths.every(path => html.includes(">" + path.label + "</option>")));
});

test("PAP-1207 S5 Edit selects only matching Core Path identity/snapshot and retains hidden metadata", () => {
  let received: MissionInput | undefined;
  const element = MissionCreateFields({
    value: sourceDraft, setValue: value => { received = value; }, disabled: false,
    editing: true, pathChoices: paths, pathState: "ready",
  }) as ReactElement<{ children: ReactNode }>;
  const labels = Children.toArray(element.props.children)
    .filter((child): child is ReactElement<{ children: ReactNode }> => isValidElement(child) && child.type === "label");
  const pathLabel = labels.find(label => Children.toArray(label.props.children).some(
    child => isValidElement(child) && child.type === "span" &&
      (child.props as { children: ReactNode }).children === "Path *",
  ));
  assert.ok(pathLabel, "Path select must exist in Edit");
  const select = Children.toArray(pathLabel.props.children).find(
    child => isValidElement(child) && child.type === "select",
  ) as ReactElement<{ onChange: (event: { target: { value: string } }) => void }> | undefined;
  assert.ok(select);
  select.props.onChange({ target: { value: paths[1]!.id } });
  assert.ok(received);
  assert.equal(received.pathProgramId, paths[1]!.id);
  assert.equal(received.pathKeySnapshot, paths[1]!.code);
  assert.equal(received.paperSize, "A4", "hidden paper metadata should not be erased");
  assert.equal(received.prerequisiteMissionId, sourceDraft.prerequisiteMissionId);
  assert.equal(received.prerequisiteCodeSnapshot, sourceDraft.prerequisiteCodeSnapshot);
  assert.equal(received.status, "ACTIVE");
});

test("PAP-1207 S5 Path validation fails closed on stale, missing or mismatched Core choices", () => {
  assert.equal(validateMissionSelectedPath(sourceDraft, paths), null);
  assert.match(validateMissionSelectedPath(sourceDraft, paths.slice(0, 3)) ?? "", /bốn Path/);
  assert.match(validateMissionSelectedPath({ pathProgramId: null, pathKeySnapshot: null }, paths) ?? "", /chọn Path/);
  assert.match(validateMissionSelectedPath({ ...sourceDraft, pathKeySnapshot: "pianohouse" }, paths) ?? "", /thay đổi/);
  assert.match(validateMissionSelectedPath({ ...sourceDraft, pathProgramId: paths[3]!.id }, paths) ?? "", /thay đổi/);
});

test("PAP-1207 S5 both Create/Edit acquire fresh Core Path before mutation; status cannot be changed by Edit", () => {
  const source = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.match(source, /if \(mode === null\) return;/);
  assert.match(source, /const invalid = validateMissionCreate\(draft\) \|\|\s+validateMissionSelectedPath\(draft, pathChoices\)/);
  assert.match(source, /if \(mode === "create" \|\| mode === "edit"\)/);
  assert.match(source, /const fresh = await loadMissionPathChoices\(\)/);
  assert.match(source, /editTarget\.status !== draft\.status/);
  assert.match(source, /kind: "update"[\s\S]*expectedVersion: editTarget!\.version/);
  assert.match(source, /result\.state === "unverified"/);
});
