import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const table=readFileSync(new URL("../app/bo/payroll-periods/BoNativePayrollPeriods.tsx",import.meta.url),"utf8");
const fields=readFileSync(new URL("../app/bo/payroll-periods/PeriodProperties.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/bo-authority-source/bo-scoped.css",import.meta.url),"utf8");
test("PAP-2001 primary create belongs to canonical page heading, not grid toolbar",()=>{
 const header=table.match(/<header className="page-heading">[\s\S]*?<\/header>/)?.[0]??"";
 assert.match(header,/className="page-heading-left"/);
 assert.match(header,/className="heading-actions"[\s\S]*current\?\.canCreate[\s\S]*Tạo mới/);
 assert.doesNotMatch(table,/toolbarActions=\{current\?\.canCreate/);
 assert.equal((table.match(/>Tạo mới<\/button>/g)??[]).length,1);
});
test("PAP-2001 dates use existing visually distinct native payroll date controls",()=>{
 assert.match(fields,/control:<div className="pay-inline-date-value"><input id=\{"period-create-"\+k\} type="date" required value=\{dates\[k\]\} disabled=\{busy\}/);
 assert.match(fields,/\(\["startDate","endDate"\] as const\)\.map/);
 assert.match(fields,/key:"name"[\s\S]*?readonly:true/);
 assert.match(fields,/disabled=\{busy\|\|!validNativePeriodDates\(dates\)\}/);
 assert.match(css,/\.pay-inline-date-value input\[type="date"\]\{[^}]*border:1px solid var\(--bo-color-border-strong\)[^}]*background:var\(--bo-color-surface\)/);
 assert.match(css,/\.pay-inline-date-value input\[type="date"\]:focus-visible/);
});