import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("Personal Ward BO is PinoriaSelf-native and uses bounded feature capabilities",async()=>{
  const [view,nav,host]=await Promise.all([
    readFile("app/bo/pinoria-ward/subjects/PersonalWardManager.tsx","utf8"),
    readFile("app/bo/navigation.ts","utf8"),
    readFile("lib/host-boundary.ts","utf8"),
  ]);
  assert.match(view,/Personal Wards/);
  assert.match(view,/Relics · 8 slots/);
  assert.match(view,/ALL","CHARACTER","ACCESSORY","RELIC/);
  assert.match(view,/type Capabilities=\{view:boolean;equip:boolean;unequip:boolean;grant:boolean;revoke:boolean\}/);
  assert.doesNotMatch(view,/\/api\/bo\/context/);
  assert.match(view,/render\.mode==="WEBM"\?null/);
  assert.match(nav,/\/bo\/pinoria-ward\/subjects/);
  assert.match(host,/\/bo\/pinoria-ward\/subjects/);
});
