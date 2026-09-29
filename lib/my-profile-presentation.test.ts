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

test("BO My Profile mutation is bounded to contact fields and never exposes authority controls", () => {
  const profile = read("app/bo/profile/BoProfileView.tsx");
  assert.match(profile, /boApi\.updateStaff\(state\.profile\.id, \{/);
  assert.match(profile, /email: email\.trim\(\) \|\| null/);
  assert.match(profile, /mobile: mobile\.trim\(\) \|\| null/);
  assert.match(profile, /legalAddress: legalAddress\.trim\(\) \|\| null/);
  assert.doesNotMatch(profile, /setStaffStatus|assignAccessRole|removeAccessAssignment|setAccessUserStatus/);
});
