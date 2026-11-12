/** PAP-1912 (PAP-1491 SPEC-UNLOCK) — live read-only Detail P0 proof.
 * Explicit, authenticated i5 CDP only. Run AFTER independent Cloudflare served-SHA
 * readback; that external verification is not performed by this runner.
 * Example:
 * PAP1912_DETAIL_G4=1 PAP1912_MODULE=subscriptions PAP1912_SERVED_SHA=<40-hex>
 * PAP1912_DEPLOYMENT_ID=<Cloudflare ID> node scripts/pap1912-detail-live-cdp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const config=JSON.parse(fs.readFileSync(path.join(root,"config/pap1912-detail-parity.json"),"utf8"));
const moduleName=process.env.PAP1912_MODULE;
const contract=config.consumers.find(x=>x.g4?.module===moduleName);
const sha=process.env.PAP1912_SERVED_SHA??"",deployment=process.env.PAP1912_DEPLOYMENT_ID??"";
if(process.env.CI||process.env.PAP1912_DETAIL_G4!=="1")throw Error("PAP1912_LIVE_G4_NOT_AUTHORIZED: explicit local-only opt-in required");
if(!contract?.g4)throw Error("PAP1912_MODULE_NOT_REGISTERED_FOR_LIVE_DETAIL_P0");
if(!/^[0-9a-f]{40}$/i.test(sha)||!deployment)throw Error("PAP1912_NO_INDEPENDENT_SERVED_SHA_DEPLOYMENT_EVIDENCE");
const meta=contract.g4;
if(meta.surface!=="BO"||meta.module!=="subscriptions")throw Error("PAP1912_MODULE_LIVE_SPEC_NOT_IMPLEMENTED: never auto-PASS new modules");
const stage="https://bo.staging.pinohouse.art"+meta.route;
const widths=[320,390,768,1024,1440,1920];
const expected=contract.tabs.map(x=>x[1]);
const cdp="http://127.0.0.1:"+meta.authPort;
const writes=[],consoleErrors=[],checks=[];
let browser,page;
const assert=(ok,why)=>{if(!ok)throw Error("TDD_DETAIL_PARITY_P0_FAIL "+why);};
const read=()=>page.evaluate(()=>{
  const root=document.querySelector('[data-tdd-shell="detail"]'),bar=root?.querySelector('[role="tablist"]');
  const tabs=[...(bar?.querySelectorAll('[role="tab"]')??[])];
  const panel=root?.querySelector('[role="tabpanel"]');
  const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=="none";
  const rect=e=>e?{w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}:null;
  const names=tabs.map(e=>(e.textContent||"").trim());
  const selected=tabs.filter(e=>e.getAttribute("aria-selected")==="true");
  const link=selected[0]&&document.getElementById(selected[0].getAttribute("aria-controls")??"");
  return {href:location.href,rootVisible:visible(root),barVisible:visible(bar),panelVisible:visible(panel),
    panelBox:rect(panel),barBox:rect(bar),rootBox:rect(root),names,selected:selected.map(e=>(e.textContent||"").trim()),
    aria:!!link&&link===panel&&panel?.getAttribute("aria-labelledby")===selected[0].id,
    scrollWidth:document.documentElement.scrollWidth,innerWidth,legacyDirect:!!root?.querySelector(':scope > .v24-prop-section')};
});
const result=(stage,extra={})=>{checks.push({stage,...extra});console.log("PAP1912_G4_CHECK "+JSON.stringify(checks.at(-1)))};
try{
  browser=await chromium.connectOverCDP(cdp,{timeout:12000});
  assert(!!browser.contexts()[0],"MISSING_I5_AUTH_CONTEXT");
  page=await browser.contexts()[0].newPage();page.setDefaultTimeout(12000);
  page.on("request",req=>{
    if(["POST","PUT","PATCH","DELETE"].includes(req.method())&&/\.staging\.pinohouse\.art/.test(req.url())&&!req.url().includes("cdn-cgi"))
      writes.push({method:req.method(),path:new URL(req.url()).pathname});
  });
  page.on("pageerror",e=>consoleErrors.push(String(e).slice(0,180)));
  await page.setViewportSize({width:1440,height:900});
  await page.goto(stage,{waitUntil:"domcontentloaded",timeout:25000});
  const auth=await page.evaluate(async()=>{
    const r=await fetch("/api/bo/context",{credentials:"include",cache:"no-store"});
    return r.status;
  });
  assert(auth===200,"AUTHENTICATED_MANAGER_CONTEXT_NOT_200");
  await page.locator(meta.tableSelector).first().waitFor({state:"visible",timeout:17000});
  await page.locator(meta.tableSelector).first().locator("button").first().click();
  await page.getByRole("button",{name:/Full Detail/i}).last().click();
  await page.locator(meta.detailSelector+" [role=tablist] [role=tab]").first().waitFor({state:"visible"});
  for(const width of widths){
    await page.setViewportSize({width,height:900});
    const d=await read();
    assert(d.rootVisible&&d.barVisible&&d.panelVisible,"MISSING_VISIBLE_DETAIL_SHELL_"+width);
    assert(d.names.join("|")===expected.join("|"),"BUSINESS_TABS_DRIFT_"+width);
    assert(d.selected.length===1&&d.aria,"TAB_ARIA_BROKEN_"+width);
    assert(!d.legacyDirect,"LEGACY_CONTENT_BYPASSES_DETAIL_PANEL_"+width);
    assert(d.scrollWidth<=d.innerWidth+1,"PAGE_HORIZONTAL_OVERFLOW_"+width);
    await page.screenshot({path:path.join(process.env.PAP1912_ARTIFACT_DIR||"D:/pino-e2e-evidence","pap1912-g4-"+moduleName+"-"+width+".png")});
    result("width",{width,tabs:d.names.length,rootW:d.rootBox?.w,barW:d.barBox?.w,panelW:d.panelBox?.w,overflow:d.scrollWidth-d.innerWidth});
  }
  await page.setViewportSize({width:1440,height:900});
  for(const tab of expected){
    await page.getByRole("tab",{name:tab,exact:true}).click();
    const d=await read();
    assert(d.selected[0]===tab&&d.aria,"TAB_ACTIVATION_"+tab);
    result("tab",{selected:tab,hasPanel:d.panelVisible,urlHasTab:new URL(d.href).searchParams.has("tab")});
  }
  await page.getByRole("tab",{name:expected[0],exact:true}).focus();
  await page.keyboard.press("ArrowRight");
  assert((await read()).selected[0]===expected[1],"KEYBOARD_ROVING_SELECTION");
  result("keyboard",{arrowRight:true});
  await page.getByRole("tab",{name:expected.at(-1),exact:true}).click();
  const targetHref=page.url();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator(meta.detailSelector+" [role=tablist] [role=tab]").first().waitFor({state:"visible",timeout:16000});
  assert(page.url()===targetHref,"DETAIL_RECORD_RELOAD_URL_CHANGED");
  assert((await read()).selected[0]===expected.at(-1),"IMMUTABLE_RECORD_RELOAD_REOPENED_DRAWER");
  result("reload",{restored:true});
  await page.getByRole("tab",{name:expected[1],exact:true}).click();
  await page.goBack({waitUntil:"domcontentloaded"});
  await page.locator(meta.detailSelector+" [role=tablist] [role=tab]").first().waitFor({state:"visible"});
  assert((await read()).selected[0]===expected.at(-1),"BROWSER_BACK_TAB_WRONG");
  await page.goForward({waitUntil:"domcontentloaded"});
  assert((await read()).selected[0]===expected[1],"BROWSER_FORWARD_TAB_WRONG");
  result("browser-history",{back:true,forward:true});
  // Center-negative uses a previously observed authorized selected-Center row,
  // never forges a write, does not disclose record ID in logs.
  const acl=await page.evaluate(async()=>{
    const c=await fetch("/api/bo/centers",{credentials:"include"}).then(r=>r.json());
    const center=c.data?.find(x=>x.displayName==="Cần Thơ");
    if(!center)return {ok:false,reason:"NO_SELECTED_CENTER"};
    const r=await fetch("/api/bo/subscriptions/center-directory?"+new URLSearchParams({centerId:center.id,limit:"50"}),{credentials:"include"});
    const d=await r.json();const id=d.data?.items?.[0]?.id;if(!id)return {ok:false,reason:"NO_AUTHORIZED_ROW"};
    const get=async url=>(await fetch(url,{credentials:"include",cache:"no-store"})).status;
    const prefix="/api/bo/subscriptions/"+encodeURIComponent(id)+"/center-detail";
    return {ok:true,own:await get(prefix+"?centerId="+encodeURIComponent(center.id)),
      foreign:await get(prefix+"?centerId=00000000-0000-4000-8000-000000000001"),
      noCenter:await get(prefix)};
  });
  assert(acl.ok&&acl.own===200&&[403,404].includes(acl.foreign)&&acl.noCenter===400,"SELECTED_CENTER_ACL_FAIL_CLOSED");
  result("center-acl",{own:acl.own,foreign:acl.foreign,missing:acl.noCenter});
  await page.locator("#back-to-list").click();
  assert((await page.locator(meta.tableSelector).count())>0,"BACK_TO_TABLE_FAILED");
  assert(!new URL(page.url()).searchParams.has("record"),"BACK_DID_NOT_CLEAR_RECORD");
  assert(writes.length===0,"UNEXPECTED_BUSINESS_WRITES");
  assert(consoleErrors.length===0,"BROWSER_RUNTIME_ERRORS");
  console.log("TDD_DETAIL_PARITY_P0_LIVE_PASS "+JSON.stringify({module:moduleName,sha,deployment,role:"Manager",widths,checks:checks.length,unexpectedWrites:0,browserErrors:0,
    note:"SHA/deployment independently read back by operator, not by this script; Founder role G4 separate"}));
}catch(e){console.error("TDD_DETAIL_PARITY_P0_LIVE_FAIL "+String(e));process.exitCode=1}
finally{if(page)await page.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});console.log("PAP1912_E2E_TAB_CLOSED")}
