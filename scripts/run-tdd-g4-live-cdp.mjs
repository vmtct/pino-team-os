// PAP-1074: separate, opt-in LOCAL Chrome CDP G4 smoke; never export auth material.
// This is not a substitute for secret-safe CI execution of the standard G4 runner.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
const BO = "https://bo.staging.pinohouse.art";
const HO = "https://ho.staging.pinohouse.art";
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const e = process.env, items = [];
function assert(value, reason) { if (!value) throw Error(reason); }
async function test(name, callback) {
  try { await callback(); items.push({ name, status: "PASS" }); }
  catch (error) { items.push({ name, status: "FAIL", reason: String(error.message || error).slice(0, 160) }); }
}
assert(e.TDD_G4_LIVE_CDP === "1" && e.TDD_G4_LOCAL_APPROVED === "1", "Explicit local CDP opt-in required");
assert(!e.CI, "CDP live profile execution must not run in CI");
assert(/^[a-f0-9]{40}$/.test(e.TDD_G4_EXPECTED_MAIN_SHA || ""), "main SHA required");
assert(e.TDD_G4_EXPECTED_MAIN_SHA === e.TDD_G4_SERVING_SHA, "stale serving SHA");
for (const key of ["TDD_G4_MAIN_CI_RUN", "TDD_G4_STAGING_CD_RUN"])
  assert(/^[1-9][0-9]+$/.test(e[key] || ""), key + " provenance required");
const main = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], { encoding: "utf8", timeout: 25000 }).split(/\s+/)[0];
assert(main === e.TDD_G4_EXPECTED_MAIN_SHA, "main has advanced; recheck CI/CD/Cloudflare");
let founder, manager, fp, mp;
try {
  founder = await chromium.connectOverCDP("http://127.0.0.1:9337", { timeout: 15000 });
  manager = await chromium.connectOverCDP("http://127.0.0.1:9335", { timeout: 15000 });
  assert(founder.contexts().length === 1 && manager.contexts().length === 1, "one Chrome context per role required");
  fp = await founder.contexts()[0].newPage();
  mp = await manager.contexts()[0].newPage();
  for (const page of [fp, mp]) {
    await page.route("**/api/**", route =>
      ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort("blockedbyclient"));
  }
  await fp.goto(BO + "/bo?module=subscriptions", { waitUntil: "domcontentloaded" });
  await mp.goto(BO + "/bo?module=subscriptions", { waitUntil: "domcontentloaded" });
  const actor = async page => page.evaluate(async () => {
    const r = await fetch("/api/bo/context", { credentials: "include" });
    const j = await r.json();
    return { status: r.status, entitled: j.data?.entitled, userId: j.data?.userId };
  });
  const fa = await actor(fp), ma = await actor(mp);
  assert(fa.status === 200 && ma.status === 200 && fa.entitled && ma.entitled && fa.userId && ma.userId && fa.userId !== ma.userId,
    "distinct authorized Founder and Manager identities required");
  items.push({ name: "distinct_authenticated_sessions", status: "PASS" });
  let subscriptionId;
  await test("founder_existing_subscription_200", async () => {
    const x = await fp.evaluate(async () => {
      const r = await fetch("/api/bo/subscriptions", { credentials: "include", cache: "no-store" });
      const j = await r.json(); const d = j.data;
      return { status: r.status, rows: Array.isArray(d) ? d : d?.items ?? d?.subscriptions ?? [] };
    });
    assert(x.status === 200, "Founder Subscription API not 200");
    subscriptionId = x.rows.find(row => UUID_V7.test(row.id))?.id;
    assert(subscriptionId, "No genuine Subscription UUIDv7");
  });
  await test("manager_subscription_403", async () => {
    const s = await mp.evaluate(async () => (await fetch("/api/bo/subscriptions", { credentials: "include" })).status);
    assert(s === 403, "Manager API status " + s);
  });
  await test("anonymous_subscription_401", async () => {
    const fresh = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
    try {
      const ctx = await fresh.newContext({ storageState: { cookies: [], origins: [] } });
      const tab = await ctx.newPage();
      await tab.goto(BO + "/bo?module=subscriptions", { waitUntil: "domcontentloaded" });
      assert(new URL(tab.url()).pathname === "/staff-login", "anonymous navigation must redirect");
      const s = await tab.evaluate(async () => (await fetch("/api/bo/subscriptions")).status);
      assert(s === 401, "anonymous API expected 401, got " + s);
      await ctx.close();
    } finally { await fresh.close(); }
  });
  if (subscriptionId) {
    await test("detail_reload_five_widths", async () => {
      const url = BO + "/bo?module=subscriptions&record=" + subscriptionId;
      await fp.goto(url, { waitUntil: "domcontentloaded" });
      for (const width of [1440, 1024, 768, 390, 320]) {
        await fp.setViewportSize({ width, height: 900 });
        await fp.reload({ waitUntil: "domcontentloaded" });
        const sub = fp.locator('[data-tdd-shell="detail"] #detail-subtitle');
        await sub.waitFor({ state: "visible", timeout: 15000 });
        assert((await sub.innerText()).trim() === subscriptionId, "wrong detail at width " + width);
        assert(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "overflow at width " + width);
      }
    });
    await test("enrollment_back_forward_three_times", async () => {
      await fp.setViewportSize({ width: 1024, height: 900 });
      for (let i = 0; i < 3; i++) {
        await fp.goto(BO + "/bo?module=subscriptions&record=" + subscriptionId, { waitUntil: "domcontentloaded" });
        const tab = fp.getByRole("tab", { name: "Enrollment" });
        await tab.click();
        await fp.waitForURL(/tab=enrollment/);
        assert(await tab.getAttribute("aria-selected") === "true", "Enrollment not selected");
        await fp.goBack({ waitUntil: "domcontentloaded" });
        await fp.waitForURL(url => !url.searchParams.has("tab"));
        await fp.goForward({ waitUntil: "domcontentloaded" });
        await fp.waitForURL(/tab=enrollment/);
        assert(await tab.getAttribute("aria-selected") === "true", "Forward did not restore Enrollment");
      }
    });
    await test("nonexistent_valid_v7_returns_404", async () => {
      const id = subscriptionId.slice(0, -1) + (subscriptionId.endsWith("f") ? "e" : "f");
      const status = await fp.evaluate(async key => (await fetch("/api/bo/subscriptions/" + key)).status, id);
      assert(status === 404, "unknown v7 API returned " + status);
    });
  }
  await test("invalid_id_never_displays_detail", async () => {
    await fp.goto(BO + "/bo?module=subscriptions&record=not-a-uuid", { waitUntil: "domcontentloaded" });
    await fp.locator('[data-bo-runtime-surface="subscriptions-core"]').waitFor({ state: "visible" });
    assert(await fp.locator('[data-bo-full-detail]').count() === 0, "invalid ID opened detail");
  });
  await test("student_to_real_subscription_full_detail", async () => {
    await fp.setViewportSize({ width: 1024, height: 900 });
    await fp.goto(BO + "/bo", { waitUntil: "domcontentloaded" });
    await fp.locator('tbody tr button[aria-label^="Quick View"]').first().waitFor({ state: "visible", timeout: 15000 });
    const studentName = await fp.evaluate(async () => {
      const response = await fetch("/api/bo/learners", { credentials: "include" });
      if (!response.ok) return null;
      const payload = await response.json();
      const rows = Array.isArray(payload.data) ? payload.data : [];
      return rows.find(row => row.activeSubscriptions > 0)?.displayName ?? null;
    });
    assert(studentName, "No subscribed Student fixture for real click path");
    await fp.locator('main input[type="search"]').fill(studentName);
    await fp.locator('tbody tr button[aria-label^="Quick View"]').first().click();
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button", { name: /Full Detail/ }).click();
    await fp.getByRole("tab", { name: "Subscription" }).click();
    const subscriptionRow = fp.locator('[data-tdd-shell="detail"] tbody tr button[aria-label^="Quick View"]').first();
    await subscriptionRow.waitFor({ state: "visible", timeout: 15000 });
    await subscriptionRow.click();
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button", { name: /Full Detail/ }).click();
    await fp.waitForURL(url => url.searchParams.get("module") === "subscriptions" &&
      UUID_V7.test(url.searchParams.get("record") ?? ""), { timeout: 12000 });
    const opened = new URL(fp.url()).searchParams.get("record");
    const title = fp.locator('[data-tdd-shell="detail"] #detail-subtitle');
    await title.waitFor({ state: "visible", timeout: 15000 });
    assert((await title.innerText()).trim() === opened, "Student click opened wrong Subscription detail");
  });
  await test("founder_ho_staff_table_drawer_full_detail", async () => {
    await fp.goto(HO + "/ho/staff", { waitUntil: "domcontentloaded" });
    await fp.locator('[data-tdd-shell="table"]').waitFor({ state: "visible", timeout: 15000 });
    const quickView = fp.locator('[data-tdd-shell="table"] tbody tr button[aria-label^="Quick View"]').first();
    await quickView.waitFor({ state: "visible", timeout: 15000 });
    await quickView.click();
    await fp.locator('[data-tdd-shell="drawer"]').waitFor({ state: "visible" });
    assert(new URL(fp.url()).searchParams.has("record"), "Drawer lost record in URL");
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button", { name: /Full Detail/ }).click();
    await fp.locator('[data-tdd-shell="detail"]').waitFor({ state: "visible" });
    assert(new URL(fp.url()).searchParams.has("record"), "Full detail lost record in URL");
    for (const name of ["Tổng quan", "Rate lương", "Lịch sử"]) {
      const tab = fp.locator('[data-tdd-shell="detail"]').getByRole("tab", { name });
      await tab.click();
      assert(await tab.getAttribute("aria-selected") === "true", "ARIA selection missing for " + name);
      const selected = await fp.locator('[data-tdd-shell="detail"] [role="tab"][aria-selected="true"]').count();
      assert(selected === 1, "Expected exactly one selected tab");
      const controls = await tab.getAttribute("aria-controls");
      assert(controls && await fp.locator('[id="' + controls + '"][role="tabpanel"]').count() === 1,
        "Tab lacks matching ARIA panel");
    }
    for (const width of [1440, 1024, 768, 390, 320]) {
      await fp.setViewportSize({ width, height: 900 });
      assert(await fp.locator('[data-tdd-shell="detail"]').isVisible(), "HO detail hidden at " + width);
      assert(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
        "HO detail page overflow at " + width);
    }
    await fp.locator('[data-tdd-shell="detail"]').getByRole("button", { name: "Quay lại bảng" }).click();
    await fp.locator('[data-tdd-shell="table"]').waitFor({ state: "visible" });
    assert(await fp.locator('[data-tdd-shell="detail"]').count() === 0, "HO back left detail mounted");
    assert(!new URL(fp.url()).searchParams.has("record"), "HO back left stale record URL");
  });
} catch (error) {
  items.push({ name: "authenticated_browser_setup", status: "FAIL", reason: String(error.message || error).slice(0, 180) });
} finally {
  await fp?.close().catch(() => {});
  await mp?.close().catch(() => {});
  await founder?.close().catch(() => {});
  await manager?.close().catch(() => {});
}
const result = { name: "PAP-1074 live local-CDP read-only (NOT complete CI G4)", sha: e.TDD_G4_EXPECTED_MAIN_SHA,
  mainCI: e.TDD_G4_MAIN_CI_RUN, stagingCD: e.TDD_G4_STAGING_CD_RUN, cases: items,
  passed: items.filter(x => x.status === "PASS").length, failed: items.filter(x => x.status === "FAIL").length };
console.log(JSON.stringify(result, null, 2));
if (result.failed || result.passed < 8) process.exitCode = 1;
