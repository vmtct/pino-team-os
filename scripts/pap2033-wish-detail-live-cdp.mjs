/** PAP-2033 / PAP-1912: Wish Detail read-only staging acceptance runner.
 * Run only after exact independent Core/Team deployment receipts, JIT profile admission
 * and an existing scoped QA fixture. No fixture creation or mutation here.
 */
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {chromium} from "@playwright/test";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const contracts={
 policy:{surface:"HO",port:9337,route:"/ho/pinoria/wish-policies",api:"/api/ho/pinoria/pls-wish/config/policies",tabs:[["overview","Tổng quan"],["history","Lịch sử"]]},
 banner:{surface:"HO",port:9337,route:"/ho/pinoria/wish-banners",api:"/api/ho/pinoria/pls-wish/config/banners",tabs:[["overview","Tổng quan"],["items","Item"],["history","Lịch sử"]]},
 event:{surface:"BO",port:9335,route:"/bo/pinoria-wish-events",api:"/api/bo/pinoria/pls-wish/events",tabs:[["overview","Tổng quan"],["items","Item"],["history","Lịch sử"]]}
};
export function validate(env){
 if(env.CI||env.PAP1912_DETAIL_G4!=="1")throw Error("G4_NOT_AUTHORIZED");
 const kind=env.PAP2033_KIND,c=contracts[kind];
 if(!c)throw Error("UNKNOWN_MODULE");
 for(const key of ["PAP1912_SERVED_SHA","PAP2033_CORE_SHA"])if(!/^[0-9a-f]{40}$/.test(env[key]??""))throw Error("MISSING_SHA "+key);
 for(const key of ["PAP1912_DEPLOYMENT_ID","PAP2033_CORE_DEPLOYMENT_ID","PAP2033_RECEIPT"])if(!env[key]?.trim())throw Error("MISSING_RECEIPT "+key);
 if(!uuid.test(env.PAP2033_RECORD??"")||!env.PAP2033_ROW_LABEL?.trim())throw Error("EXACT_FIXTURE_REQUIRED");
 if(c.surface==="BO"&&(!uuid.test(env.PAP2033_CENTER??"")||!uuid.test(env.PAP2033_ACTOR??"")||!uuid.test(env.PAP2033_FOREIGN_CENTER??"")||env.PAP2033_CENTER===env.PAP2033_FOREIGN_CENTER))throw Error("BO_SCOPE_REQUIRED");
 return {kind,c,origin:"https://"+c.surface.toLowerCase()+".staging.pinohouse.art",record:env.PAP2033_RECORD,label:env.PAP2033_ROW_LABEL,center:env.PAP2033_CENTER,actor:env.PAP2033_ACTOR,foreign:env.PAP2033_FOREIGN_CENTER};
}
export async function run(env){
 const {kind,c,origin,record,label,center,actor,foreign}=validate(env),checks=[],writes=[],errors=[];
 let browser,page,anonymous;
 const layout=async labels=>{
  const r=await page.locator("#detail-screen").evaluate(root=>{
   const bar=root.querySelector('[role="tablist"]'),panel=root.querySelector('[role="tabpanel"]'),tabs=[...(bar?.querySelectorAll('[role="tab"]')??[])],active=tabs.filter(t=>t.getAttribute("aria-selected")==="true");
   const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
   return {visible:visible(root.querySelector(".detail-hero"))&&visible(root.querySelector(".detail-cover"))&&visible(bar)&&visible(panel),names:tabs.map(t=>t.textContent.trim()),selected:active[0]?.textContent.trim(),aria:active.length===1&&document.getElementById(active[0].getAttribute("aria-controls"))===panel&&panel?.getAttribute("aria-labelledby")===active[0].id,overflow:document.documentElement.scrollWidth-innerWidth,details:document.querySelectorAll("#detail-screen").length};
  });
  assert(r.visible&&r.aria&&r.overflow<=1&&r.details===1,JSON.stringify(r));assert.deepEqual(r.names,labels);return r.selected;
 };
 const status=async url=>page.evaluate(async p=>{const r=await fetch(p,{cache:"no-store",credentials:"same-origin"});return r.status;},url);
 try{
  browser=await chromium.connectOverCDP("http://127.0.0.1:"+c.port,{timeout:12000});
  page=await browser.contexts()[0].newPage();page.setDefaultTimeout(15000);
  await page.route("**/*",async route=>{const req=route.request();if(!["GET","HEAD","OPTIONS"].includes(req.method())){if(new URL(req.url()).pathname!=="/cdn-cgi/rum")writes.push(req.method()+" "+new URL(req.url()).pathname);await route.abort();}else await route.continue();});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+c.route,{waitUntil:"domcontentloaded",timeout:30000});
  if(c.surface==="BO"){
   const v=await page.evaluate(async center=>{const r=await fetch("/api/bo/context?"+new URLSearchParams({centerId:center}),{cache:"no-store"});if(!r.ok)return null;return(await r.json()).data;},center);
   assert(v?.surface==="BO"&&v.entitled===true&&v.userId===actor&&v.permissionKeys.includes("pinoria.wish_event.view"),"BO_ACTOR");
   assert.equal(await status(c.api+"/"+record+"?centerId="+center),200);
   assert([403,404].includes(await status(c.api+"/"+record+"?centerId="+foreign)),"FOREIGN_CENTER");
  }else assert.equal(await status(c.api),200);
  const row=page.getByRole("row",{name:"Mở Quick View "+label,exact:true});
  await row.waitFor();assert.equal(await row.count(),1);await row.press("Enter");
  await page.locator("#drawer").waitFor();await page.locator("#full-detail").click();
  const labels=c.tabs.map(x=>x[1]),tabs=page.locator("#detail-screen [role=tab]");
  await tabs.first().waitFor();
  const p=new URL(page.url()).searchParams;assert.equal(p.get("record"),record,"FIXTURE_RECORD_MISMATCH");
  if(c.surface==="BO")assert.equal(p.get("wishCenter"),center);else assert(p.get("wishSelection")&&p.get("wishRevision"),"HO_REVISION_PIN");
  for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});await layout(labels);checks.push("width-"+width);}
  for(const [key,name] of c.tabs){await page.getByRole("tab",{name,exact:true}).click();assert.equal(await layout(labels),name);assert.equal(new URL(page.url()).searchParams.get("tab"),key);}
  await page.getByRole("tab",{name:labels[0],exact:true}).click();await page.getByRole("tab",{name:labels[0],exact:true}).focus();await page.keyboard.press("ArrowRight");assert.equal(await layout(labels),labels[1]);
  const href=page.url();await page.reload({waitUntil:"domcontentloaded"});await tabs.first().waitFor();assert.equal(page.url(),href);assert.equal(await layout(labels),labels[1]);
  await page.getByRole("tab",{name:labels[0],exact:true}).click();await page.goBack();assert.equal(await layout(labels),labels[1]);await page.goForward();assert.equal(await layout(labels),labels[0]);checks.push("keyboard-reload-history");
  if(kind==="event"){
   await page.getByRole("tab",{name:"Item",exact:true}).click();
   await page.locator("#detail-screen tbody tr").first().press("Enter");
   await page.locator("#drawer").waitFor();await page.locator("#full-detail").click();
   await page.getByRole("tab",{name:"Tổng quan",exact:true}).waitFor();await layout(["Tổng quan"]);
   await page.locator("#back-to-list").click();assert.equal(await layout(labels),"Item");checks.push("reward-context-return");
   // Contextual reward direct URL replay is a separate requirement, not inferred from return.
  }
  await page.locator("#back-to-list").click();await page.locator("#list-screen").waitFor();
  anonymous=await browser.newContext();
  const unauth=await anonymous.request.get(origin+c.api+(c.surface==="BO"?"?centerId="+center:""),{maxRedirects:0});
  assert([301,302,303,307,308,401,403,404].includes(unauth.status()),"UNAUTH_READ");
  assert.equal(writes.length,0);assert.equal(errors.length,0);
  console.log("PAP2033_DETAIL_READONLY_CASE_PASS "+JSON.stringify({kind,checks,sha:env.PAP1912_SERVED_SHA,coreSha:env.PAP2033_CORE_SHA,receipt:env.PAP2033_RECEIPT,rewardDirectReload:kind==="event"?"NOT_RUN":null}));
 }finally{if(anonymous)await anonymous.close();if(page)await page.close();if(browser)await browser.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run(process.env);
