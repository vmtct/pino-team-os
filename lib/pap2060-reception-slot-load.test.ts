import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("PAP-2060 late schedule selects the first eligible slot and scopes composer state to the selected occurrence",()=>{
 const s=readFileSync(new URL("../app/components/tos-vnext/ReceptionV4OpenShift.tsx",import.meta.url),"utf8");
 assert.match(s,/const slot=props\.slots\?\.find\(s=>s\.shiftTemplateId===selected\)\?\?props\.slots\?\.\[0\]/);
 assert.match(s,/key=\{JSON\.stringify\(\[slot\?\.centerId,slot\?\.workDate,slot\?\.shiftTemplateId\]\)\}/);
 assert.match(s,/value=\{slot\?\.shiftTemplateId\?\?""\} disabled=\{busy\}/);
 assert.match(s,/if\(!centerId\|\|!workDate\|\|!shiftTemplateId\)return/);
});
