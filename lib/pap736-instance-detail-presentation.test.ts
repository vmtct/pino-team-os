import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const detail=readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstanceDetail.tsx",import.meta.url),"utf8");
const directory=readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstanceDirectory.tsx",import.meta.url),"utf8");
test("Instance drawer fetches only selected authenticated detail and fences stale responses",()=>{
 assert.match(detail,/pinoria\/worlds\/instances\/\$\{id\}/);
 assert.match(detail,/const controller=new AbortController/);
 assert.match(detail,/controller\.abort\(\)/);
 assert.match(directory,/PinoriaInstanceDetail id=\{selected\.id\}/);
});
test("Instance mutations use existing Core authority and confirmed guarded commands",()=>{
 for(const action of ["set-live","revoke","reactivate"]) assert.match(detail,new RegExp(action));
 assert.match(detail,/window\.confirm\(confirmation\)/);
 assert.match(detail,/if\(busy\|\|!detail\)return/);
 assert.match(detail,/await load\(\)/);
 assert.match(detail,/onChanged\(\)/);
});
test("Scene and media toggles are canonical, never optimistic Save-all",()=>{
 assert.match(detail,/base}\/scenes\/\$\{s\.id\}/);
 assert.match(detail,/base}\/layers\/\$\{layer\.id\}/);
 assert.match(detail,/layer\.kind==="CHARACTER"/);
 assert.match(detail,/detail\.status==="REVOKED"/);
 assert.match(detail,/!detail\.sceneAccess\[scene\.id\]/);
 assert.doesNotMatch(detail,/Save all|bulkUnlock|PATCH.*displayLabel/i);
});
