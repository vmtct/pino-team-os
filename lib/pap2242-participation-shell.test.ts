import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx", import.meta.url), "utf8");

test("PAP-2242 Participation shell shows canonical read-only business columns", () => {
  for (const heading of ["Person", "Trạng thái", "Nhóm", "Lượt sử dụng"]) {
    assert.ok(source.includes(heading), `Missing ${heading}`);
  }
  assert.match(source, /rows\.map\(row/);
  assert.match(source, /Chưa có người tham gia/);
});

test("PAP-2242 create CTA is gated by BO-authorized host callback", () => {
  assert.match(source, /canCreate && onCreate/);
  assert.match(source, /onCreate=\{onCreate\}/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage/);
});
