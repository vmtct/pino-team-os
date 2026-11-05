import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const manager=readFileSync(new URL("../app/bo/pinoria-world/PinoriaWorldManager.tsx",import.meta.url),"utf8");
test("PAP-736 deep-linked instance selects instance tab without a prior learner selection",()=>{
 assert.match(manager,/params\.get\("view"\)==="instances"/);
 assert.match(manager,/params\.has\("instance"\)/);
 assert.match(manager,/function changeMode\(next:/);
 assert.match(manager,/window\.addEventListener\("popstate",sync\)/);
 assert.match(manager,/onClick=\{\(\)=>changeMode\("INSTANCE"\)\}/);
});
test("Explicit worlds tab overrides stale instance selection and preserves URL query",()=>{
 assert.match(manager,/!params\.has\("view"\)&&params\.has\("instance"\)/);
 assert.match(manager,/url\.searchParams\.set\("view",next==="INSTANCE"\?"instances":"worlds"\)/);
 assert.match(manager,/window\.history\.pushState/);
});
