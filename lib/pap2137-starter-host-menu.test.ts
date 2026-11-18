import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/ho/pinoria/starter-sets/HoStarterSets.tsx",import.meta.url),"utf8");
test("PAP-2137 uses the native host menu in List and Detail; explicit override remains supported",()=>{
 assert.match(source,/useContext\(TddHostMenu\)/);
 assert.match(source,/mobileMenu\?\?hostMenu\("detail-menu-btn"\)/);
 assert.match(source,/mobileMenu\?\?hostMenu\("menu-btn"\)/);
 assert.doesNotMatch(source,/setMobileOpen|mobile-shade|nav-search/);
});
