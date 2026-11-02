// PAP-1075 — staging-only read-only Parent TDD preview acceptance.
// Reuses bounded G4 identities; does not persist auth state, screenshots, traces or PII.
import { chromium } from "playwright";
import { verifyStaging } from "./pap1074-g4-attestation.mjs";

const BO = "https://bo.staging.pinohouse.art";
const env = process.env;
const cases = [], fields = ["TDD_G4_FOUNDER_EMAIL", "TDD_G4_FOUNDER_PASSWORD"];
const assert = (valid, reason) => { if (!valid) throw Error(reason); };
let stage = "preflight", browser, founder, anonymous;
async function check(name, run) {
  try { stage = name; await run(); cases.push({ name, status: "PASS" }); }
  catch (error) { cases.push({ name, status: "FAIL", phase: stage, errorType: error?.name ?? "Error" }); }
}
async function login(context) {
  const page = await context.newPage();
  try {
    stage = "founder_auth";
    await page.goto(BO + "/staff-login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 16000 });
    await page.getByLabel("Email").fill(env.TDD_G4_FOUNDER_EMAIL);
    await page.getByLabel("Mật khẩu").fill(env.TDD_G4_FOUNDER_PASSWORD);
    const reply = page.waitForResponse(r => new URL(r.url()).pathname === "/api/staff-auth/login" && r.request().method() === "POST", { timeout: 18000 });
    await page.getByRole("button", { name: "Vào PINO Team" }).click();
    assert((await reply).status() === 200, "Founder login not accepted");
    await page.waitForURL(u => !u.pathname.startsWith("/staff-login"), { timeout: 18000 });
  } finally { await page.close(); }
}
try {
  assert(env.CI === "true" && env.PAP1075_PREVIEW_RUN === "1", "CI preview opt-in required");
  for (const key of fields) assert(env[key] && env[key].length > 3, "QA auth unavailable");
  const proof = await verifyStaging(env);
  console.log(JSON.stringify({ name: "PAP-1075 exact SHA staging receipt", ...proof, status: "PASS" }));
  browser = await chromium.launch({ headless: true });
  founder = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  anonymous = await browser.newContext({ viewport: { width: 1024, height: 900 }, storageState: { cookies: [], origins: [] } });
  await anonymous.route("**/api/**", r =>
    ["GET", "HEAD", "OPTIONS"].includes(r.request().method()) ? r.continue() : r.abort("blockedbyclient"));
  await check("anonymous_preview_requires_auth", async () => {
    const page = await anonymous.newPage();
    try {
      await page.goto(BO + "/bo?module=parents&pilot=tdd", { waitUntil: "domcontentloaded" });
      await page.waitForURL(u => u.pathname === "/staff-login", { timeout: 15000 });
    } finally { await page.close(); }
  });
  await login(founder);
  await founder.route("**/api/**", r =>
    ["GET", "HEAD", "OPTIONS"].includes(r.request().method()) ? r.continue() : r.abort("blockedbyclient"));
  const page = await founder.newPage();
  await check("canonical_parent_route_remains_legacy", async () => {
    await page.goto(BO + "/bo?module=parents", { waitUntil: "domcontentloaded" });
    await page.locator('[data-bo-runtime="react"][data-bo-module="parents"]').waitFor({ state: "visible", timeout: 15000 });
    assert(await page.locator('#tdd-parent-center').count() === 0, "Default Parent route unexpectedly cut over");
  });
  await check("typed_preview_is_server_admitted", async () => {
    await page.goto(BO + "/bo?module=parents&pilot=tdd", { waitUntil: "domcontentloaded" });
    await page.locator('section[aria-label="Parents & Guardians"]').waitFor({ state: "visible", timeout: 15000 });
    await page.locator('.workspace-switcher .nav-workspace').waitFor({ state: "visible", timeout: 12000 });
    assert(await page.locator('#tdd-parent-center').count() === 0, "Inline Center selector must be absent");
  });
  let centerId;
  await check("core_attested_selected_center_directory", async () => {
    const switcher = page.locator(".workspace-switcher .nav-workspace");
    await switcher.click();
    await page.waitForFunction(() => document.querySelectorAll('#workspace-centers [role="option"]').length > 0 || Boolean(document.querySelector('p[role="alert"]')), null, { timeout: 14000 });
    const choices = page.locator('#workspace-centers [role="option"]');
    assert(await choices.count() >= 1, "No authorized Center candidate");
    await choices.first().click();
    centerId = new URL(page.url()).searchParams.get("centerId");
    assert(centerId, "Shell Center change did not update scoped URL");
    const result = await page.evaluate(async id => {
      const query = new URLSearchParams({ centerId: id, limit: "10", offset: "0" });
      const res = await fetch("/api/bo/identity/parents/directory?" + query, { credentials: "same-origin", cache: "no-store" });
      const j = await res.json().catch(() => null);
      return {
        status: res.status,
        receiptMatches: j?.data?.scopeCenterId === id,
        countValid: Number.isSafeInteger(j?.data?.total) && Array.isArray(j?.data?.items),
      };
    }, centerId);
    assert(result.status === 200 && result.receiptMatches && result.countValid, "Center receipt/ACL not accepted");
    await page.locator('#list-screen').waitFor({ state: "visible", timeout: 18000 });
  });
  await check("preview_5_widths_no_horizontal_overflow", async () => {
    assert(centerId, "Center not authorized");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.locator('section[aria-label="Parents & Guardians"]').count() === 1, "Parent preview not mounted");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), "Preview page overflow");
    }
  });
  console.log(JSON.stringify({ name: "PAP-1075 Parent TDD live staging preview", cases, passed: cases.filter(x => x.status === "PASS").length, failed: cases.filter(x => x.status === "FAIL").length }));
  if (cases.some(x => x.status !== "PASS")) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ name: "PAP-1075 preview admission", status: "FAIL", phase: stage, errorType: error?.name ?? "Error" }));
  process.exitCode = 1;
} finally {
  await founder?.close().catch(() => {});
  await anonymous?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
