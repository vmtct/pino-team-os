// PAP-1074 — CI-only authenticated G4 Staging acceptance.
// Auth is ephemeral: no storageState export, screenshot, trace, credential output or fixture writes.
import { chromium } from "playwright";
import { verifyStaging } from "./pap1074-g4-attestation.mjs";
const BO = "https://bo.staging.pinohouse.art";
const HO = "https://ho.staging.pinohouse.art";
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const env = process.env;
const cases = [];
function assert(ok, reason) { if (!ok) throw Error(reason); }
async function check(name, fn) {
  try { await fn(); cases.push({name,status:"PASS"}); }
  catch { cases.push({name,status:"FAIL"}); }
}
async function login(context, origin, email, password) {
  const page = await context.newPage();
  try {
    await page.goto(origin + "/staff-login", {waitUntil:"domcontentloaded"});
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button",{name:"Vào PINO Team"}).click();
    await page.waitForURL(u => !u.pathname.startsWith("/staff-login") &&
      !u.pathname.startsWith("/staff-password"), {timeout:18000});
  } finally { await page.close(); }
}
async function guard(context) {
  await context.route("**/api/**", route =>
    ["GET","HEAD","OPTIONS"].includes(route.request().method()) ?
      route.continue() : route.abort("blockedbyclient"));
}
async function actor(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/bo/context", {credentials:"include"});
    const j = await r.json();
    return {status:r.status,entitled:j.data?.entitled,userId:j.data?.userId};
  });
}
const keys = ["TDD_G4_FOUNDER_EMAIL","TDD_G4_FOUNDER_PASSWORD","TDD_G4_MANAGER_EMAIL","TDD_G4_MANAGER_PASSWORD"];
let browser, founder, manager, anon, fp, mp;
try {
  assert(env.CI === "true" && env.TDD_G4_RUN === "1", "CI opt-in required");
  for (const key of keys) assert(env[key] && env[key].length >= 3, "missing identity");
  assert(env.TDD_G4_FOUNDER_EMAIL !== env.TDD_G4_MANAGER_EMAIL, "distinct identities required");
  const proof = await verifyStaging(env);
  console.log(JSON.stringify({name:"PAP-1074 GitHub + Cloudflare receipt",...proof,status:"PASS"}));
  browser = await chromium.launch({headless:true});
  founder = await browser.newContext({viewport:{width:1024,height:900}});
  manager = await browser.newContext({viewport:{width:1024,height:900}});
  anon = await browser.newContext({viewport:{width:1024,height:900},storageState:{cookies:[],origins:[]}});
  await login(founder, BO, env.TDD_G4_FOUNDER_EMAIL, env.TDD_G4_FOUNDER_PASSWORD);
  await login(founder, HO, env.TDD_G4_FOUNDER_EMAIL, env.TDD_G4_FOUNDER_PASSWORD);
  await login(manager, BO, env.TDD_G4_MANAGER_EMAIL, env.TDD_G4_MANAGER_PASSWORD);
  await guard(founder); await guard(manager); await guard(anon);
  fp = await founder.newPage(); mp = await manager.newPage();
  await fp.goto(BO + "/bo?module=subscriptions",{waitUntil:"domcontentloaded"});
  await mp.goto(BO + "/bo?module=subscriptions",{waitUntil:"domcontentloaded"});
  const fa = await actor(fp), ma = await actor(mp);
  assert(fa.status === 200 && fa.entitled && ma.status === 200 && ma.entitled &&
    fa.userId && ma.userId && fa.userId !== ma.userId, "distinct entitled identities required");
  cases.push({name:"distinct_authenticated_sessions",status:"PASS"});

  let subscriptionId;
  await check("founder_existing_subscription_200", async () => {
    const result = await fp.evaluate(async () => {
      const r = await fetch("/api/bo/subscriptions", {credentials:"include",cache:"no-store"});
      const j = await r.json();
      const x = j.data;
      return {status:r.status,rows:Array.isArray(x)?x:x?.items??x?.subscriptions??[]};
    });
    assert(result.status === 200,"Founder read denied");
    subscriptionId = result.rows.find(r => UUID_V7.test(r.id))?.id;
    assert(subscriptionId,"No authorized existing Subscription UUIDv7");
  });
  await check("manager_subscription_403", async () => {
    const s = await mp.evaluate(async () => (await fetch("/api/bo/subscriptions")).status);
    assert(s === 403,"Manager must be forbidden");
  });
  await check("anonymous_subscription_401", async () => {
    const p = await anon.newPage();
    try {
      await p.goto(BO + "/bo?module=subscriptions", {waitUntil:"domcontentloaded"});
      assert(new URL(p.url()).pathname === "/staff-login", "anonymous page not guarded");
      const s = await p.evaluate(async () => (await fetch("/api/bo/subscriptions")).status);
      assert(s === 401,"anonymous API not guarded");
    } finally {await p.close();}
  });
  await check("detail_reload_five_widths", async () => {
    assert(subscriptionId,"Subscription unavailable");
    await fp.goto(BO + "/bo?module=subscriptions&record=" + subscriptionId,{waitUntil:"domcontentloaded"});
    for (const width of [1440,1024,768,390,320]) {
      await fp.setViewportSize({width,height:900});
      await fp.reload({waitUntil:"domcontentloaded"});
      const node = fp.locator('[data-tdd-shell="detail"] #detail-subtitle');
      await node.waitFor({state:"visible",timeout:16000});
      assert((await node.innerText()).trim() === subscriptionId,"detail mismatch");
      assert(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),"overflow");
    }
  });
  await check("enrollment_back_forward_three_times", async () => {
    assert(subscriptionId,"Subscription unavailable");
    await fp.setViewportSize({width:1024,height:900});
    for (let i=0;i<3;i++) {
      await fp.goto(BO + "/bo?module=subscriptions&record=" + subscriptionId,{waitUntil:"domcontentloaded"});
      await fp.getByRole("tab",{name:"Enrollment"}).click();
      await fp.waitForURL(/tab=enrollment/);
      assert(await fp.getByRole("tab",{name:"Enrollment"}).getAttribute("aria-selected") === "true","Enrollment tab");
      await fp.goBack({waitUntil:"domcontentloaded"});
      await fp.waitForURL(url => !url.searchParams.has("tab"));
      await fp.goForward({waitUntil:"domcontentloaded"});
      await fp.waitForURL(/tab=enrollment/);
      assert(await fp.getByRole("tab",{name:"Enrollment"}).getAttribute("aria-selected") === "true","forward tab");
    }
  });
  await check("nonexistent_valid_v7_returns_404",async () => {
    assert(subscriptionId,"Subscription unavailable");
    const id = subscriptionId.slice(0,-1) + (subscriptionId.endsWith("f")?"e":"f");
    const status = await fp.evaluate(async key => (await fetch("/api/bo/subscriptions/" + key)).status,id);
    assert(status === 404,"unknown canonical record must be 404");
  });
  await check("invalid_id_never_displays_detail",async () => {
    await fp.goto(BO + "/bo?module=subscriptions&record=not-a-uuid",{waitUntil:"domcontentloaded"});
    await fp.locator('[data-bo-runtime-surface="subscriptions-core"]').waitFor({state:"visible"});
    assert(await fp.locator('[data-bo-full-detail]').count() === 0,"invalid detail mounted");
  });
  await check("student_to_real_subscription_full_detail",async () => {
    await fp.setViewportSize({width:1024,height:900});
    await fp.goto(BO + "/bo",{waitUntil:"domcontentloaded"});
    await fp.locator('tbody tr button[aria-label^="Quick View"]').first().waitFor({state:"visible",timeout:15000});
    const name = await fp.evaluate(async () => {
      const r = await fetch("/api/bo/learners",{credentials:"include"});
      if (!r.ok) return null;
      const body = await r.json();
      return (Array.isArray(body.data)?body.data:[]).find(s => s.activeSubscriptions > 0)?.displayName ?? null;
    });
    assert(name,"No subscribed Student");
    await fp.locator('main input[type="search"]').fill(name);
    await fp.locator('tbody tr button[aria-label^="Quick View"]').first().click();
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button",{name:/Full Detail/}).click();
    await fp.getByRole("tab",{name:"Subscription"}).click();
    const row = fp.locator('[data-tdd-shell="detail"] tbody tr button[aria-label^="Quick View"]').first();
    await row.waitFor({state:"visible",timeout:15000});
    await row.click();
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button",{name:/Full Detail/}).click();
    await fp.waitForURL(url => url.searchParams.get("module") === "subscriptions" &&
      UUID_V7.test(url.searchParams.get("record")||""),{timeout:15000});
    const id = new URL(fp.url()).searchParams.get("record");
    const title = fp.locator('[data-tdd-shell="detail"] #detail-subtitle');
    await title.waitFor({state:"visible",timeout:15000});
    assert((await title.innerText()).trim() === id,"wrong opened Subscription");
  });
  await check("founder_ho_staff_table_drawer_full_detail",async () => {
    await fp.goto(HO + "/ho/staff",{waitUntil:"domcontentloaded"});
    await fp.locator('[data-tdd-shell="table"]').waitFor({state:"visible",timeout:15000});
    const row = fp.locator('[data-tdd-shell="table"] tbody tr button[aria-label^="Quick View"]').first();
    await row.waitFor({state:"visible",timeout:15000});
    await row.click();
    await fp.locator('[data-tdd-shell="drawer"]').waitFor({state:"visible"});
    assert(new URL(fp.url()).searchParams.has("record"),"drawer URL");
    await fp.locator('[data-tdd-shell="drawer"]').getByRole("button",{name:/Full Detail/}).click();
    await fp.locator('[data-tdd-shell="detail"]').waitFor({state:"visible"});
    for (const name of ["Tổng quan","Rate lương","Lịch sử"]) {
      const tab = fp.locator('[data-tdd-shell="detail"]').getByRole("tab",{name});
      await tab.click();
      assert(await tab.getAttribute("aria-selected") === "true","ARIA selection");
      const controls = await tab.getAttribute("aria-controls");
      assert(controls && await fp.locator('[id="' + controls + '"][role="tabpanel"]').count() === 1,"tabpanel linkage");
      assert(await fp.locator('[data-tdd-shell="detail"] [role="tab"][aria-selected="true"]').count() === 1,"single selected tab");
    }
    for (const width of [1440,1024,768,390,320]) {
      await fp.setViewportSize({width,height:900});
      assert(await fp.locator('[data-tdd-shell="detail"]').isVisible(),"hidden HO detail");
      assert(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),"HO overflow");
    }
    await fp.locator('[data-tdd-shell="detail"]').getByRole("button",{name:"Quay lại bảng"}).click();
    await fp.locator('[data-tdd-shell="table"]').waitFor({state:"visible"});
    assert(await fp.locator('[data-tdd-shell="detail"]').count() === 0,"detail still mounted");
    assert(!new URL(fp.url()).searchParams.has("record"),"stale record URL");
  });
} catch {
  cases.push({name:"authenticated_ci_admission",status:"FAIL"});
} finally {
  await fp?.close().catch(()=>{});
  await mp?.close().catch(()=>{});
  await browser?.close().catch(()=>{});
}
const passed = cases.filter(x=>x.status==="PASS").length;
const failed = cases.length-passed;
console.log(JSON.stringify({name:"PAP-1074 G4 Staging CI ephemeral-auth read-only",cases,passed,failed},null,2));
if (failed || passed !== 10) process.exitCode = 1;
