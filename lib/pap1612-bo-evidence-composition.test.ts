import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
test("PAP-1612 Timekeeping evidence reuses shared table drawer detail",()=>{
 const s=readFileSync("app/bo/workforce/timekeeping/BoCheckInEvidence.tsx","utf8");
 const parent=readFileSync("app/bo/workforce/timekeeping/TimekeepingView.tsx","utf8");
 for(const tag of ["PayrollDsaReadTable","BoQuickView","DetailFrame","PropertySections"])assert.match(s,new RegExp("<"+tag+"\\b"));
 assert.match(s,/rows=\{\[record\]\}/);assert.match(s,/record=\{record\}/);assert.match(s,/id:"photo"/);assert.match(s,/id:"history"/);
 assert.doesNotMatch(s,/fetch\(|https?:\/\/|localStorage|sessionStorage/);
 assert.match(parent,/review && evidenceOpen/);assert.match(parent,/Về chấm công|Bằng chứng check-in/);
});
