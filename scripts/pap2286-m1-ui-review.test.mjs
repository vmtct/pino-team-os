import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("PAP-2286 detail replaces table in M1", () => {
 const view=fs.readFileSync("app/bo/sales/leads/LeadHouseholdM1Preview.tsx","utf8");
 const css=fs.readFileSync("app/bo/sales/leads/lead-household-m1.module.css","utf8");
 assert.match(view, /!selectedLead \? <><header/);
 assert.match(view, /<BoDataGrid[\s\S]*?<\/\> : null\}[\s\S]*?selectedLead \? <BoFullDetail/);
 assert.match(view, /designVariant="business-v25"/);
 assert.match(view, /styles\.formPropertyRow/);
 assert.match(css, /\.formPropertyRow\s*\{\s*display: grid; grid-template-columns: minmax\(130px/);
});
