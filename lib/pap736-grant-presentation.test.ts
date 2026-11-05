import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const grant=readFileSync(new URL("../app/bo/pinoria-world/PinoriaGrantDrawer.tsx",import.meta.url),"utf8");
const directory=readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstanceDirectory.tsx",import.meta.url),"utf8");
test("Grant consumes canonical ACTIVE learner and non-archived World selection",()=>{
 assert.match(grant,/pinoria\/worlds\/learners/);
 assert.match(grant,/l\.learners\.filter\(s=>s\.status==="ACTIVE"\)/);
 assert.match(grant,/w\.worlds\.filter\(world=>world\.status!=="ARCHIVED"\)/);
});
test("Cancel does not call Grant or auto-activate",()=>{
 assert.match(grant,/onClick=\{onClose\}>Cancel/);
 assert.match(grant,/onClick=\{\(\)=>void confirmGrant\(\)\}/);
 assert.match(grant,/method:"POST"/);
 assert.doesNotMatch(grant,/set-live|scene-access|layer-unlock/);
});
test("Grant only submits validated explicit selection and opens canonical followup search",()=>{
 assert.match(grant,/if\(busy\|\|!studentId\|\|!worldId\|\|!label\.trim\(\)\)return/);
 assert.match(grant,/displayLabel:label\.trim\(\)/);
 assert.match(grant,/result\.status!=="INACTIVE"/);
 assert.match(directory,/onGranted=\{id=>/);
 assert.match(directory,/setQuery\(id\)/);
});
