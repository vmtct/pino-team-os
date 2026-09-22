import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "app/components/WorkforceWorkspace.tsx"), "utf8");
const dutySource = fs.readFileSync(path.join(process.cwd(), "app/check-in/DutyAwareCheckInOut.tsx"), "utf8");
const facade = fs.readFileSync(path.join(process.cwd(), "app/api/workforce/[...path]/route.ts"), "utf8");
const apiSource = fs.readFileSync(path.join(process.cwd(), "lib/workforce-api.ts"), "utf8");
const dutyBoardSource = fs.readFileSync(path.join(process.cwd(), "app/tasks/DutyBoardView.tsx"), "utf8");

test("TOS scopes empty current-timekeeping reads to the selected Center", () => {
  assert.match(apiSource, /currentTimekeeping:\(centerId\?:string\).*centerId/);
  assert.match(source, /const selected = c\.data\.centers\[0\];[\s\S]*currentTimekeeping\(selected\?\.id\)/);
  assert.match(dutySource, /currentTimekeeping\(nextContext\.centers\[0\]\?\.id\)/);
  assert.match(dutyBoardSource, /currentTimekeeping\(nextContext\.centers\[0\]\?\.id\)/);
});

test("TOS timekeeping preserves one command key across ambiguous retries", () => {
  assert.match(source, /clockAttempt = useRef<\{ action: "in" \| "out"; fingerprint: string; key: string \} \| null>\(null\)/);
  assert.match(source, /const fingerprint = `\$\{center\.id\}:\$\{state\.data\.assignment\.id\}`/);
  assert.match(source, /prior\?\.action === "in" && prior\.fingerprint !== fingerprint/);
  assert.match(source, /workforceApi\.currentTimekeeping\(center\.id\)/);
  assert.match(source, /prior\?\.action === "in" && prior\.fingerprint === fingerprint \? prior\.key : crypto\.randomUUID\(\)/);
  assert.match(source, /clockAttempt\.current = \{ action: "in", fingerprint, key: idempotencyKey \}/);
  assert.match(source, /state\.data\.kind !== "ELIGIBLE_ASSIGNMENT"/);
  assert.match(source, /workforceApi\.checkIn\(center\.id, state\.data\.assignment\.id, idempotencyKey\)/);
  assert.match(source, /workforceApi\.checkOut\(idempotencyKey\)/);
  assert.match(source, /setCurrent\(result\.data\);\s*clockAttempt\.current = null/);
});


test("Duty-aware check-in/out preserves caller-owned retry identity behind current eligibility gates", () => {
  assert.match(dutySource, /clockAttempt = useRef<\{ action: "in" \| "out"; fingerprint: string; key: string \} \| null>\(null\)/);
  assert.match(dutySource, /state\.data\.kind !== "ELIGIBLE_ASSIGNMENT"/);
  assert.match(dutySource, /const fingerprint = `\$\{center\.id\}:\$\{state\.data\.assignment\.id\}`/);
  assert.match(dutySource, /prior\?\.action === "in" && prior\.fingerprint === fingerprint \? prior\.key : crypto\.randomUUID\(\)/);
  assert.match(dutySource, /workforceApi\.checkIn\(center\.id, state\.data\.assignment\.id, idempotencyKey\)/);
  assert.match(dutySource, /prior\?\.action === "out" && prior\.fingerprint === fingerprint \? prior\.key : crypto\.randomUUID\(\)/);
  assert.match(dutySource, /workforceApi\.checkOut\(idempotencyKey\)/);
});

test("TOS workforce facade fails closed when timekeeping mutation lacks an idempotency key", () => {
  assert.match(facade, /corePath==="\/timekeeping\/check-in"\|\|corePath==="\/timekeeping\/check-out"/);
  assert.match(facade, /!idempotencyKey\)return Response\.json\(\{error:\{code:"PLATFORM_INVALID_INPUT",message:"Idempotency-Key is required"\}/);
});
