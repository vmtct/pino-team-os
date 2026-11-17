import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/bo/payroll-periods/BoNativePayrollPeriods.tsx",import.meta.url),"utf8");
const settlement=ui.slice(ui.indexOf("function Settlements("),ui.indexOf("function PeriodHistory("));
test("PAP-2012 settlement tab restores full-period Core totals",()=>{
 assert.match(settlement,/periodSummaries\(page\.periodTotals\)/);
 assert.match(settlement,/data-pay-total-expected/);
 assert.match(settlement,/data-pay-total-finalized/);
 assert.match(settlement,/hasPending/);
 assert.match(settlement,/hasUnavailable/);
});
test("PAP-2012 visible salary/status use existing PINO design system",()=>{
 assert.match(settlement,/payroll-ro-amount/);
 assert.match(settlement,/BoPill/);
 assert.match(settlement,/settlementStatus/);
 assert.match(settlement,/staffWithWorkEvidence\(rows\)/);
 assert.match(settlement,/staffWithWorkEvidenceCount/);
 assert.doesNotMatch(settlement,/periodApi\.(finalize|paid|preview|create|edit|cancel)/);
});