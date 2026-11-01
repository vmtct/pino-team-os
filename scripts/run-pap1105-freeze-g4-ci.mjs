// PAP-1105: bounded Staging acceptance. No entity writes, auth export, screenshots, traces, or DOM/text dumps.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { verifyStaging } from "./pap1074-g4-attestation.mjs";
import { BO, HO, COLLECTION, allowedRequest, verifyFreezePersistence, recordFreezeCase, safeParentProbe } from "./pap1105-freeze-g4-contract.mjs";
const env = process.env, cases = [];
let browser, phase = "preflight", permit = null;
async function check(name, fn) {
  phase = name;
  return recordFreezeCase(cases,name,fn);
}
async function login(context, origin, role) {
  const page = await context.newPage();
  try {
    await page.goto(origin + "/staff-login",{waitUntil:"domcontentloaded"});
    await page.waitForLoadState("networkidle",{timeout:14000});
    await page.getByLabel("Email").fill(env["TDD_G4_" + role + "_EMAIL"]);
    await page.getByLabel("Mật khẩu").fill(env["TDD_G4_" + role + "_PASSWORD"]);
    const reply = page.waitForResponse(r => new URL(r.url()).pathname === "/api/staff-auth/login" && r.request().method() === "POST");
    await page.getByRole("button",{name:"Vào PINO Team"}).click();
    assert.equal((await reply).status(),200);
    await page.waitForURL(u => !u.pathname.startsWith("/staff-login") && !u.pathname.startsWith("/staff-password"));
  } finally {await page.close();}
}
async function fence(context) {
  await context.route("**/*",route => {
    const request=route.request();
    return allowedRequest(request.url(),request.method(),request.postData(),permit) ? route.continue() : route.abort("blockedbyclient");
  });
}
async function call(page, method, path, body, id) {
  assert(path === COLLECTION || path.startsWith(COLLECTION + "/"));
  assert(!permit, "No concurrent writes");
  if(method !== "GET") permit={method,path,body,id};
  try {
    const result = await page.evaluate(async ({method,path,body}) => {
      const response = await fetch(path,{method,credentials:"same-origin",cache:"no-store",
        ...(body ? {headers:{"content-type":"application/json"},body:JSON.stringify(body)} : {})});
      const json=await response.json().catch(()=>null);
      return {status:response.status,data:json?.data};
    },{method,path,body});
    console.log(JSON.stringify({name:"shared_view_http",method,kind:path===COLLECTION?"collection":"fixture",status:result.status}));
    return result;
  } finally {permit=null;}
}
async function geometry(page, width) {
  await page.setViewportSize({width,height:900});
  const trigger=page.locator("[data-freeze-trigger]").last();
  await trigger.waitFor({state:"visible"});
  const requested = await trigger.getAttribute("data-freeze-trigger");
  if(width===1440){
    await trigger.focus();await trigger.press("Shift+F10");
    await page.getByRole("menu",{name:/Cố định cột/}).waitFor({state:"visible"});
    await page.keyboard.press("Escape");
    assert(await trigger.evaluate(el => document.activeElement===el));
  }
  await trigger.click();
  await page.getByRole("menuitem",{name:"Cố định đến cột này",exact:true}).click();
  await page.waitForFunction(target => Object.entries(history.state ?? {}).some(([key,state]) =>
    key.startsWith("pino:tdd:") && state?.query?.frozenThrough === target),requested);
  await page.waitForLoadState("networkidle",{timeout:15000});
  await page.waitForFunction(() => {
    const headers=document.querySelectorAll("thead [data-tdd-freeze-cell]");
    const rows=[...document.querySelectorAll("tbody tr[data-record]")];
    return headers.length > 0 && rows.length > 0 && rows.every(r => r.querySelectorAll("td[data-tdd-freeze-cell]").length === headers.length);
  });
  await page.locator("#table-scroll").evaluate(el => {el.scrollLeft=300;});
  await page.waitForFunction(() => {
    const h=document.querySelector("thead [data-tdd-freeze-cell]");
    const b=document.querySelector("tbody [data-tdd-freeze-cell]");
    return !!h && !!b && Math.abs(h.getBoundingClientRect().left-b.getBoundingClientRect().left)<2;
  });
  const result=await page.evaluate(() => {
    const v=document.getElementById("table-scroll");
    const columns=[...document.querySelectorAll("thead th[data-column]")];
    const pinned=columns.filter(h => h.hasAttribute("data-tdd-freeze-cell"));
    const metrics=pinned.map(h => {
      const b=document.querySelector('tbody td[data-freeze-column="'+h.dataset.column+'"]');
      const hr=h.getBoundingClientRect(),br=b.getBoundingClientRect();
      return {key:h.dataset.column,left:hr.left,bodyLeft:br.left,width:hr.width,offset:parseFloat(getComputedStyle(h).left),sticky:getComputedStyle(h).position === "sticky"};
    });
    return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,viewportWidth:v.clientWidth,
      viewportLeft:v.getBoundingClientRect().left,scrollWidth:v.scrollWidth,scrollLeft:v.scrollLeft,
      prefix:columns.slice(0,pinned.length).map(h=>h.dataset.column),metrics,
      protectedTrigger:!!document.querySelector('[data-freeze-trigger="name"],[data-freeze-trigger="id"]')};
  });
  assert(result.documentWidth<=width+2 && result.metrics[0]?.key === "name" && !result.protectedTrigger);
  assert.deepEqual(result.metrics.map(c=>c.key),result.prefix);
  if(result.scrollWidth>result.viewportWidth+2) assert(result.scrollLeft>0);
  for(let i=0;i<result.metrics.length;i++){
    const c=result.metrics[i];assert(c.sticky && Math.abs(c.left-c.bodyLeft)<2);
    assert(Math.abs(c.left-result.viewportLeft-c.offset)<2);
    if(i)assert(c.left>=result.metrics[i-1].left+result.metrics[i-1].width-2);
  }
  const end=result.metrics.at(-1).offset+result.metrics.at(-1).width;
  assert(end<result.viewportWidth);
  if(result.metrics.length>1)assert(end<=result.viewportWidth-112+2);
  console.log(JSON.stringify({name:"freeze_geometry",...result}));
  if(width===1440){
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForLoadState("networkidle",{timeout:15000});
    await page.locator("tbody tr[data-record]").first().waitFor({state:"visible"});
    assert(await page.evaluate(target => Object.entries(history.state??{}).some(([key,state]) =>
      key.startsWith("pino:tdd:") && state?.query?.frozenThrough===target),requested));
  }
}
try {
  assert(env.CI==="true" && env.TDD_FREEZE_G4_RUN==="1" && env.TDD_FREEZE_G4_RETAIN_FIXTURE==="1");
  for(const role of ["FOUNDER","MANAGER"])for(const key of ["EMAIL","PASSWORD"]) assert(env["TDD_G4_"+role+"_"+key]);
  assert.notEqual(env.TDD_G4_FOUNDER_EMAIL,env.TDD_G4_MANAGER_EMAIL);
  console.log(JSON.stringify({name:"serving_attestation",...await verifyStaging(env)}));
  browser=await chromium.launch({headless:true});
  const founder=await browser.newContext(),manager=await browser.newContext(),anon=await browser.newContext();
  phase="ephemeral_auth";
  await login(founder,BO,"FOUNDER");await login(founder,HO,"FOUNDER");await login(manager,BO,"MANAGER");
  for(const context of [founder,manager,anon]) await fence(context);
  const fp=await founder.newPage(),mp=await manager.newPage(),ap=await anon.newPage();
  await fp.goto(BO+"/bo?module=subscriptions",{waitUntil:"domcontentloaded"});
  await mp.goto(BO+"/bo?module=subscriptions",{waitUntil:"domcontentloaded"});
  await ap.goto(BO+"/staff-login",{waitUntil:"domcontentloaded"});
  assert(await check("distinct_authorized_actors",async()=>{
    const actor=page=>page.evaluate(async()=>{const r=await fetch("/api/bo/context");return {status:r.status,data:(await r.json()).data};});
    const f=await actor(fp),m=await actor(mp);
    assert(f.status===200&&m.status===200&&f.data?.entitled&&m.data?.entitled&&f.data.userId&&m.data.userId&&f.data.userId!==m.data.userId);
  }));
  const roleIsolated=await check("shared_view_role_isolation",async()=>{
    assert.equal((await call(mp,"GET",COLLECTION)).status,403);
    assert.equal((await call(ap,"GET",COLLECTION)).status,401);
  });
  const parentReady=await check("bo_parent_fixture_read",async()=>{
    await fp.goto(BO+"/bo?module=parents&pilot=tdd",{waitUntil:"domcontentloaded"});
    const switcher=fp.locator(".workspace-switcher .nav-workspace");
    await switcher.click();
    await fp.waitForFunction(()=>document.querySelectorAll('#workspace-centers [role="option"]').length>0);
    const count=await fp.locator('#workspace-centers [role="option"]').count();
    let found=false;
    for(let index=0;index<Math.min(count,20);index++){
      if(index>0) await switcher.click();
      await fp.locator('#workspace-centers [role="option"]').nth(index).click();
      const value=new URL(fp.url()).searchParams.get("centerId");
      assert(value);
      const raw=await fp.evaluate(async centerId=>{
        const query=new URLSearchParams({centerId,limit:"100",offset:"0"});
        const response=await fetch("/api/bo/identity/parents/directory?"+query,{cache:"no-store"});
        const body=await response.json().catch(()=>null);
        const context=await fetch("/api/bo/context",{cache:"no-store"});
        const actor=await context.json().catch(()=>null);
        return {status:response.status,total:body?.data?.total,items:body?.data?.items?.length,
          scopeMatches:body?.data?.scopeCenterId===centerId,
          readGrant:actor?.data?.permissionKeys?.includes("identity.parent_directory.view")===true};
      },value);
      const dom=()=>fp.evaluate(()=>({
        selected:!!new URL(location.href).searchParams.get("centerId"),
        table:!!document.querySelector("#typed-table"),
        rows:!!document.querySelector("tbody tr[data-record]"),
        alert:!!document.querySelector('[role="alert"]'),
        loading:!!document.querySelector('[role="status"]'),
      }));
      console.log(JSON.stringify({name:"parent_directory_probe",...safeParentProbe({...raw,...await dom(),index})}));
      if(raw.status!==200||raw.total===0)continue;
      assert(raw.scopeMatches && Number.isSafeInteger(raw.total) && raw.total>0 && raw.items>0);
      try {
        await fp.locator("tbody tr[data-record]").first().waitFor({state:"visible",timeout:16000});
        found=true;break;
      } catch(error) {
        console.log(JSON.stringify({name:"parent_projection_probe",...safeParentProbe({...raw,...await dom(),index})}));
        throw error;
      }
    }
    assert(found);
  });
  for(const width of [1440,1024,768,390,320])await check("bo_freeze_"+width,async()=>{assert(parentReady);await geometry(fp,width);});
  const hp=await founder.newPage();
  const hoReady=await check("ho_shared_views_unavailable",async()=>{
    await hp.goto(HO+"/ho/centers",{waitUntil:"domcontentloaded"});
    const status=await hp.evaluate(async()=> (await fetch("/api/bo/views/subscriptions")).status);
    assert.equal(status,404);
  });
  for(const width of [1440,1024,768,390,320])await check("ho_freeze_"+width,async()=>{assert(hoReady);await geometry(hp,width);});
  await check("persisted_freeze_cas_restore",async()=>{
    assert(roleIsolated && hoReady);
    await fp.goto(BO+"/bo?module=subscriptions",{waitUntil:"domcontentloaded"});
    const receipt=await verifyFreezePersistence((method,path,body,id)=>call(fp,method,path,body,id),
      {onFixture: fixture => console.log(JSON.stringify({name:"retained_synthetic_view_inventory",...fixture}))});
    console.log(JSON.stringify({name:"retained_synthetic_view_receipt",...receipt}));
  });
  await check("final_serving_attestation",async()=>{await verifyStaging(env);});
} catch {
  if(!cases.some(c=>c.status==="FAIL"))cases.push({name:phase,status:"FAIL",errorType:"AdmissionOrAuthFailure"});
} finally {await browser?.close().catch(()=>{});}
const passed=cases.filter(c=>c.status==="PASS").length,failed=cases.length-passed;
console.log(JSON.stringify({name:"PAP-1105 live geometry and separate Shared View contract acceptance",cases,passed,failed,
  limitation:"Parent/HO pilot Views are local-ui; persisted contract is independently tested on the existing Subscription Shared Views API. This is not an adopted durable TDD module journey."},null,2));
if(failed||passed!==16)process.exitCode=1;
