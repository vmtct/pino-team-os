import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "app/components/WorkforceWorkspace.tsx"), "utf8");
const facade = fs.readFileSync(path.join(process.cwd(), "app/api/workforce/[...path]/route.ts"), "utf8");

test("TOS timekeeping preserves one command key across ambiguous retries", () => {
  assert.match(source, /clockAttempt = useRef<\{ action: "in" \| "out"; fingerprint: string; key: string \} \| null>\(null\)/);
  assert.match(source, /prior\?\.action === action && prior\.fingerprint === fingerprint \? prior\.key : crypto\.randomUUID\(\)/);
  assert.match(source, /clockAttempt\.current = \{ action, fingerprint, key: idempotencyKey \}/);
  assert.match(source, /workforceApi\.checkIn\(center\.id, assignmentId, idempotencyKey\)/);
  assert.match(source, /workforceApi\.checkOut\(idempotencyKey\)/);
  assert.match(source, /setCurrent\(result\.data\);\s*clockAttempt\.current = null/);
});


test("TOS workforce facade fails closed when timekeeping mutation lacks an idempotency key", () => {
  assert.match(facade, /corePath==="\/timekeeping\/check-in"\|\|corePath==="\/timekeeping\/check-out"/);
  assert.match(facade, /!idempotencyKey\)return Response\.json\(\{error:\{code:"PLATFORM_INVALID_INPUT",message:"Idempotency-Key is required"\}/);
});
