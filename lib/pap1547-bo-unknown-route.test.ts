import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1547 / PAP-1316: invalid BO query modules do not silently change Center or open Students", () => {
  const page = readFileSync("app/bo/page.tsx", "utf8");
  assert.match(page, /import \{ notFound, redirect \} from "next\/navigation";/);
  assert.match(page, /query\.module !== undefined && \(typeof query\.module !== "string" \|\| !BO_SIDEBAR_MODULES\.includes\(query\.module\)\)\) notFound\(\)/);
  assert.doesNotMatch(page, /redirect\("\/bo"\)/);
  assert.match(page, /if \(query\.module === "salaryPeriods"\) redirect\(retiredSalaryPeriodRedirectUrl\(query\)\)/);
  assert.match(page, /\["centerId", "from", "to"\]/);
});
