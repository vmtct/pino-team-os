import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("403 TOS V4 keeps a visible session exit and preserves server-side gate",()=>{
 const forbidden=readFileSync("app/tos-v4/forbidden.tsx","utf8");
 const page=readFileSync("app/tos-v4/page.tsx","utf8");
 const logout=readFileSync("app/components/tos-shell/LogoutButton.tsx","utf8");
 assert.match(forbidden,/LogoutButton/);
 assert.match(forbidden,/Tài khoản chưa có quyền vào TOS/);
 assert.match(page,/forbidden\(\)/);
 assert.match(page,/authorizeTosV4Staging/);
 assert.match(logout,/\/api\/staff-auth\/logout/);
 assert.match(logout,/window\.location\.replace\("\/staff-login"\)/);
 assert.doesNotMatch(forbidden,/staffMemberId|document\.cookie|localStorage/);
});
