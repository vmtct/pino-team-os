import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function read(path: string) { return readFile(path, "utf8"); }
async function missing(path: string) {
  try { await access(path); return false; } catch { return true; }
}

test("Team serving configuration retires Staff PIN binding and routes", async () => {
  const [production, staging, middleware, host, workforce, learning] = await Promise.all([
    read("wrangler.jsonc"),
    read("wrangler.staging.jsonc"),
    read("middleware.ts"),
    read("lib/host-boundary.ts"),
    read("app/api/workforce/[...path]/route.ts"),
    read("app/api/tos-learning/[...path]/route.ts"),
  ]);
  const serving = [production, staging, middleware, host, workforce, learning].join("\n");
  assert.doesNotMatch(production, /PINO_STAFF_PIN_CORE|StaffPinControlPlane/);
  assert.doesNotMatch(staging, /PINO_STAFF_PIN_CORE|StaffPinControlPlane/);
  assert.doesNotMatch(middleware, /get\("pino_staff_session"\)/);
  assert.doesNotMatch(workforce, /staffPinSession|callWorkforceCoreWithStaffPin/);
  assert.doesNotMatch(learning, /staffPinSession|callTosLearningCoreWithStaffPin/);
  assert.doesNotMatch(host, /staff-pin\/reset/);
  assert.ok(await missing("app/api/staff-pin/login/route.ts"));
  assert.ok(await missing("app/api/staff-pin/status/route.ts"));
  assert.ok(await missing("app/api/staff-pin/change/route.ts"));
  assert.ok(await missing("app/staff-pin/change/page.tsx"));
  assert.doesNotMatch(serving, /\/api\/staff-pin\/(?:login|status|change)/);
});

test("temporary-password login is routed only to forced password change before normal navigation", async () => {
  const [loginApi, loginPage, changeApi, changePage, coreBinding] = await Promise.all([
    read("app/api/staff-auth/login/route.ts"),
    read("app/staff-login/page.tsx"),
    read("app/api/staff-auth/change-password/route.ts"),
    read("app/staff-password/change/page.tsx"),
    read("lib/staff-password-core.ts"),
  ]);
  assert.match(loginApi, /passwordChangeRequired/);
  assert.match(loginPage, /passwordChangeRequired \? "\/staff-password\/change"/);
  assert.match(changeApi, /PINO_STAFF_PASSWORD_CORE\.changePassword/);
  assert.match(changeApi, /pino_staff_password_session=\$\{result\.token\}/);
  assert.match(changePage, /passwordChangeRequired/);
  assert.match(changePage, /\/api\/staff-auth\/change-password/);
  assert.match(coreBinding, /changePassword\(token:string/);
});

test("BO exposes governed password reset and one-time secret UX without PIN reset", async () => {
  const [api, write, view, model, registration] = await Promise.all([
    read("lib/bo-api.ts"),
    read("lib/bo-write-handler.ts"),
    read("app/bo/staff/StaffManagementView.tsx"),
    read("lib/bo-model.ts"),
    read("app/bo/staff/StaffRegistrationReviewQueue.tsx"),
  ]);
  assert.match(api, /resetStaffPassword:[\s\S]*staff-password\/reset/);
  assert.doesNotMatch(api, /resetStaffPin|staff-pin\/reset/);
  assert.match(write, /STAFF_PASSWORD_RESET_PATH/);
  assert.match(write, /Staff password reset body must be empty/);
  assert.match(view, /permissionKeys\.includes\("access\.staff_password\.reset"\)/);
  assert.match(view, /data-testid="staff-password-reset-reveal"/);
  assert.match(view, /temporaryPassword/);
  assert.match(view, /data\.actor\.userId !== accessUser\.id/);
  assert.doesNotMatch(view, /resetStaffPin|staff-pin\/reset/);
  assert.match(model, /PASSWORD_RESET_REQUIRED/);
  assert.doesNotMatch(model, /RESET_STAFF_PIN|PIN_RESET_REQUIRED|initialPin/);
  assert.doesNotMatch(registration, /initialPin|registration-pin-reveal/);
  assert.match(registration, /email \+ mật khẩu/);
});

test("Roles remain dynamic permission-registry consumers without Manager hard-code", async () => {
  const [roles, view] = await Promise.all([
    read("app/bo/system/roles/AccessRolesView.tsx"),
    read("app/bo/staff/StaffManagementView.tsx"),
  ]);
  assert.match(roles, /permissionKeys/);
  assert.match(view, /access\.staff_password\.reset/);
  assert.doesNotMatch(roles, /roleKey\s*===\s*["']manager["']/i);
  assert.doesNotMatch(view, /roleKey\s*===\s*["']manager["']/i);
});

test("logout revokes password authority and only clears legacy PIN cookie as inert cutover cleanup", async () => {
  const logout = await read("lib/staff-logout-handler.ts");
  assert.match(logout, /PINO_STAFF_PASSWORD_CORE\.logout/);
  assert.doesNotMatch(logout, /PINO_STAFF_PIN_CORE|\.logout\(pinToken\)/);
  assert.match(logout, /pino_staff_session=;/);
});
