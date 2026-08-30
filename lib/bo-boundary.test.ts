import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("wrangler keeps production ingress gated outside source deploys and preserves private Core bindings", async () => {
  const source = await readFile("wrangler.jsonc", "utf8");
  assert.match(source, /"PINO_BO_CORE"[^\n]+"pino-core"[^\n]+"BoAccessControlPlane"/);
  assert.match(source, /"PINO_TOS_LEARNING_CORE"[^\n]+"pino-core"[^\n]+"TosLearningControlPlane"/);
  assert.doesNotMatch(source, /"(?:tos|bo|team)\.pinohouse\.art"/);
  assert.doesNotMatch(source, /"routes"\s*:/);
  assert.doesNotMatch(source, /"CF_ACCESS_BO_AUD"\s*:/);
});

test("BO facade uses only BO auth and PINO_BO_CORE", async () => {
  const sources = await Promise.all([
    readFile("app/api/bo/context/route.ts", "utf8"),
    readFile("lib/bo-context-handler.ts", "utf8"),
    readFile("lib/bo-core.ts", "utf8"),
  ]).then((items) => items.join("\n"));
  assert.match(sources, /PINO_BO_CORE/);
  assert.match(sources, /CF_ACCESS_BO_AUD/);
  assert.doesNotMatch(sources, /FOUNDER_EMAIL/);
  assert.doesNotMatch(sources, /FounderControlPlane|PINO_WORKFORCE_CORE|targetStaffMemberId|userId=|staffMemberId=/);
});

test("BO read plane stays bounded while the API exposes only governed BO writes", async () => {
  const readSources = await Promise.all([
    readFile("app/bo/layout.tsx", "utf8"),
    readFile("app/bo/page.tsx", "utf8"),
    readFile("app/bo/BoOperationalView.tsx", "utf8"),
    readFile("lib/bo-read-handler.ts", "utf8"),
  ]).then((items) => items.join("\n"));
  const apiSource = await readFile("lib/bo-api.ts", "utf8");
  const sources = `${readSources}\n${apiSource}`;

  assert.match(sources, /BoShell/);
  assert.match(sources, /\/api\/bo\//);
  assert.match(sources, /Running Classes|Sessions|Registrations|Syllabus \/ Programs/);
  assert.doesNotMatch(sources, /founderApi|WorkforceWorkspace|\/founder|\/api\/workforce|NOTION|PINO_CORE|PINO_WORKFORCE_CORE/);
  assert.doesNotMatch(readSources, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(apiSource, /method:\s*["'](?:PUT|PATCH|DELETE)["']/);
  assert.equal((apiSource.match(/method:\s*["']POST["']/g) ?? []).length, 1);
  assert.match(apiSource, /updateStaff:[\s\S]*workforce\/staff-records/);
  assert.match(apiSource, /setStaffStatus:[\s\S]*\/status/);
  assert.match(apiSource, /assignAccessRole:[\s\S]*access\/assignments/);
  assert.match(apiSource, /removeAccessAssignment:[\s\S]*access\/assignments\/remove/);
  assert.match(apiSource, /setAccessUserStatus:[\s\S]*access\/users\/status/);
  assert.doesNotMatch(apiSource, /configureStaffPin|\/api\/staff-pin\/configure/);
  assert.match(apiSource, /onboardStaff:[\s\S]*write<BoStaffOnboardingResult>\("workforce\/staff-onboarding"/);
  assert.match(apiSource, /assignLearningOwner:[\s\S]*write<BoSessionLearningOwner>/);
});


test("Staff BO surfaces derive scope catalogs from canonical delivery bootstrap", async () => {
  const apiSource = await readFile("lib/bo-api.ts", "utf8");
  const staffSources = await Promise.all([
    readFile("app/bo/staff/StaffManagementView.tsx", "utf8"),
    readFile("app/bo/staff/StaffOnboardingView.tsx", "utf8"),
  ]).then((items) => items.join("\n"));

  assert.match(apiSource, /scopeCatalog:[\s\S]*delivery\/bootstrap-state/);
  assert.equal((staffSources.match(/boApi\.scopeCatalog\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(staffSources, /boApi\.(?:centers|pathPrograms|runningClasses)\(/);
});

test("BO layout gates canonical authorization before rendering the shell", async () => {
  const source = await readFile("app/bo/layout.tsx", "utf8");
  assert.match(source, /dynamic\s*=\s*["']force-dynamic["']/);
  assert.match(source, /authorizeBoShell/);
  assert.match(source, /forbidden\(\)/);
  assert.match(source, /PINO_BO_CORE|BoShellGateEnv/);
  assert.ok(source.indexOf("authorizeBoShell") < source.indexOf("<BoShell"));
});
