import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("PAP-709 approved Home app order and disabled access toast", () => {
  const home = read("app/TosHome.tsx");
  assert.match(home, /id:"shift"[\s\S]*id:"reception"[\s\S]*id:"station"[\s\S]*id:"shift-lead"[\s\S]*id:"classroom"/);
  assert.match(home, /Ca này bạn chưa có quyền/);
  assert.match(home, /resolveTosAppAccess/);
  assert.doesNotMatch(home, /roleLabel\s*===|SHIFT_ROLES|fakeRole|mockRole/);
  assert.match(home, /<SupportSessionBanner/);
  assert.doesNotMatch(home, /TOS_HOME_FOOTER/);
});

test("PAP-709 four approved Ca Làm contextual tabs", () => {
  const nav = read("app/components/tos-shell/navigation.ts");
  const block = nav.split("export const TOS_SHIFT_FOOTER:")[1]?.split("];")[0] ?? "";
  assert.deepEqual([...block.matchAll(/label: "([^"]+)"/g)].map(m => m[1]), ["Hôm nay", "Lịch ca", "Giờ công", "Thu nhập"]);
  assert.deepEqual([...block.matchAll(/href: "([^"]+)"/g)].map(m => m[1]), ["/dashboard", "/schedule", "/timesheet", "/earnings"]);
});

test("PAP-709 Home 430px centered and black gutters", () => {
  const css = read("app/tos-home-v2.module.css");
  assert.match(css, /background:\s*#000/);
  assert.match(css, /width:\s*min\(100%,\s*430px\)/);
  assert.match(css, /margin:\s*0 auto/);
});

test("PAP-709 unavailable payroll must not invent money", () => {
  const page = read("app/earnings/page.tsx");
  assert.match(page, /Chưa sẵn sàng/);
  assert.doesNotMatch(page, /1\.625\.000|2\.100\.000/);
});
