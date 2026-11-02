import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boCenterWave1Href, isBoCenterReadWave1 } from "./BoCenterWave1";

const centerA = "0199f001-0000-7000-8000-000000000001";
const centerB = "0199f001-0000-7000-8000-000000000002";

test("PAP-1327: only verified Visits, Timekeeping and Classes adapters are active", () => {
  assert.equal(isBoCenterReadWave1("visits"), true);
  assert.equal(isBoCenterReadWave1("timekeeping"), true);
  assert.equal(isBoCenterReadWave1("classes"), true);
  for (const key of ["students", "parents", "subscriptions", "audits", "staffs", "missions"]) {
    assert.equal(isBoCenterReadWave1(key), false);
    assert.equal(boCenterWave1Href("/bo?module=" + key, key, centerA, [centerA]), "/bo?module=" + key);
  }
});

test("PAP-1327: scoped module links carry only authorized Center and clear stale record", () => {
  assert.equal(
    boCenterWave1Href("/bo?module=timekeeping&record=old&from=2026-10-01#detail", "timekeeping", centerB, [centerA, centerB]),
    "/bo?module=timekeeping&from=2026-10-01&centerId=" + centerB,
  );
  assert.equal(boCenterWave1Href("/bo?module=visits", "visits", centerA, [centerA]), "/bo?module=visits&centerId=" + centerA);
  assert.equal(boCenterWave1Href("/bo?module=visits", "visits", centerB, [centerA]), "/bo?module=visits");
  assert.equal(boCenterWave1Href("https://another-host.invalid/bo", "visits", centerA, [centerA]), "https://another-host.invalid/bo");
});

test("PAP-1327: runtime never mounts a Center-specific legacy read before authorization", () => {
  const src = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  assert.match(src, /isBoCenterReadWave1\(moduleKey\)/);
  assert.match(src, /center\.loading \|\| Boolean\(center\.error\) \|\| !selected/);
  assert.match(src, /content=\{blocked \? <CenterReadPending/);
  assert.match(src, /centerId: selected/);
  assert.match(src, /TddHostMenu/);
  const legacy = readFileSync("public/bo-authority-source/school-adapters.js", "utf8");
  assert.match(legacy, /const centers=async path=>/);
  assert.match(legacy, /if\(options\.centerId\)\{id\(options\.centerId\)/);
  assert.match(legacy, /if\(row\.centerId!==centerId\)throw Error/);
});
