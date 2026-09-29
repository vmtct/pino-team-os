import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("TOS current user identity uses canonical profile displayLabel and links to My Profile", () => {
  const user = read("app/components/tos-shell/TosCurrentUser.tsx");
  const home = read("app/TosHome.tsx");
  assert.match(user, /workforceApi\.profile\(\)/);
  assert.match(user, /shortDisplayName\(profile\?\.displayLabel\)/);
  assert.match(user, /href="\/info"/);
  assert.match(home, /<TosGreeting \/>/);
});

test("BO shell receives canonical current-user context and exposes My Profile", () => {
  const layout = read("app/bo/layout.tsx");
  const menu = read("app/components/tos-shell/BoCurrentUserMenu.tsx");
  assert.match(layout, /currentUser = await authorizeBoShell/);
  assert.match(layout, /currentUser=\{currentUser\}/);
  assert.match(menu, /shortDisplayName\(currentUser\.displayName\)/);
  assert.match(menu, /href="\/bo\/profile"/);
});

test("BO My Profile is self-only presentation and never reuses Staff admin mutations", () => {
  const profile = read("app/bo/profile/BoProfileView.tsx");
  assert.match(profile, /fetch\("\/api\/bo\/context"/);
  assert.match(profile, /context\.staffProfile/);
  assert.doesNotMatch(profile, /boApi\.updateStaff|setStaffStatus|assignAccessRole|removeAccessAssignment|setAccessUserStatus/);
  assert.match(profile, /BO không dùng quyền Manager để tự sửa hồ sơ hay ACL/);
});
