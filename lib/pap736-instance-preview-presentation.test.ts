import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const preview=readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstancePreview.tsx",import.meta.url),"utf8");
const drawer=readFileSync(new URL("../app/bo/pinoria-world/PinoriaInstanceDetail.tsx",import.meta.url),"utf8");
test("PAP-736 drawer renders canonical current Character and Ward rather than mock",()=>{
 assert.match(drawer,/character=\{detail\.character\?\?null\}/);
 assert.match(preview,/<LayeredCharacter className=\{styles\.worldCharacter\} config=\{character\.config\} wardRender=\{character\.wardRender\}/);
 assert.match(preview,/Character unavailable/);
});
test("PAP-736 preview fails closed for inaccessible scenes and locked media",()=>{
 assert.match(preview,/if\(!accessible\)return/);
 assert.match(preview,/!unlocked\.includes\(layer\.id\)/);
 assert.match(preview,/layer\.kind==="CHARACTER"/);
 assert.match(preview,/layer\.mediaType==="WEBM"/);
});
