import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=(name:string)=>readFileSync(new URL("../app/bo/pinoria-avatars/"+name,import.meta.url),"utf8");
test("PAP-2122 both Create callers use existing selected-Center loadout capability",()=>{
 assert.match(file("AvatarDirectoryDsa.tsx"),/canUseStarter=\{grants\.has\("pinoria\.self\.loadout\.manage"\)\}/);
 assert.match(file("SelfDirectoryTdd.tsx"),/canUseStarter=\{current\.adapter\.context\.authorize\("pinoria\.self\.loadout\.manage"\)\}/);
});
test("PAP-2122 missing capability prevents catalog request and optional selection; server 403 distinct from retry",()=>{
 const source=file("CreateSelfDrawer.tsx");
 assert.match(source,/if\(!canUseStarter\)return;[\s\S]*?fetch\("\/api\/bo\/pinoria\/avatars\/starter-sets/);
 assert.match(source,/r\.status===403[\s\S]*?setStarterDenied\(true\);return \[\]/);
 assert.match(source,/choice=canUseStarter&&!starterDenied\?starterCatalog\.find/);
 assert.match(source,/canUseStarter&&!starterDenied\?<><div/);
 assert.match(source,/!starterId\|\|!!choice/);
 assert.match(source,/choice\?\{starter:/);
 assert.match(source,/Bạn chưa có quyền chọn Starter Set/);
});