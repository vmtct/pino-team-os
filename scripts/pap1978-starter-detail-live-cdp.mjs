/** PAP-1978 / PAP-1912 — explicit local-only authenticated HO Detail G4. */
import fs from "node:fs";
import path from "node:path";
import {chromium} from "@playwright/test";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const cfg=JSON.parse(fs.readFileSync(path.join(root,"config/pap1912-detail-parity.json"),"utf8"));
const contract=cfg.consumers.find(c=>c.g4?.module==="starterSets");
if(process.env.CI||process.env.PAP1912_DETAIL_G4!=="1")throw Error("PAP1912_LIVE_G4_NOT_AUTHORIZED");
if(!/^[0-9a-f]{40}$/i.test(process.env.PAP1912_SERVED_SHA??"")||!process.env.PAP1912_DEPLOYMENT_ID)throw Error("PAP1912_NO_INDEPENDENT_SERVED_SHA_DEPLOYMENT_EVIDENCE");
if(!contract||contract.g4.surface!=="HO"||contract.g4.authPort!==9337)throw Error("PAP1978_HO_CONTRACT_MISSING");
const meta=contract.g4, origin="https://ho.staging.pinohouse.art", expected=contract.tabs.map(t=>t[1]);
const assert=(ok,msg)=>{if(!ok)throw Error("PAP1978_G4_FAIL "+msg);};
const writes=[],errors=[],checks=[];
let browser,page;
try{
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+meta.authPort,{timeout:12000});
 page=await browser.contexts()[0].newPage();page.setDefaultTimeout(15000);
 page.on("request",r=>{if(["POST","PUT","PATCH","DELETE"].includes(r.method())&&r.url().startsWith(origin))writes.push(r.method()+" "+new URL(r.url()).pathname);});
 page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(origin+meta.route,{waitUntil:"domcontentloaded",timeout:30000});
 const auth=await page.evaluate(async()=>{const r=await fetch("/api/ho/pinoria/items",{credentials:"include",cache:"no-store"});return r.status;});
 assert(auth===200,"HO_ITEM_AUTH");
 await page.locator(meta.tableSelector).first().waitFor({state:"visible"});
 await page.locator(meta.tableSelector).first().locator("button").first().click();
 await page.getByRole("button",{name:/Full Detail/i}).last().click();
 const tabs=page.locator(meta.detailSelector+" [role=tab]");
 await tabs.first().waitFor();
 const read=()=>page.evaluate(selector=>{
  const root=document.querySelector(selector),bar=root?.querySelector('[role="tablist"]'),panel=root?.querySelector('[role="tabpanel"]');
  const tabs=[...(bar?.querySelectorAll('[role="tab"]')??[])],active=tabs.filter(t=>t.getAttribute("aria-selected")==="true");
  const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
  return {visible:visible(root)&&visible(bar)&&visible(panel),names:tabs.map(t=>t.textContent.trim()),selected:active.map(t=>t.textContent.trim()),aria:active.length===1&&document.getElementById(active[0].getAttribute("aria-controls"))===panel&&panel?.getAttribute("aria-labelledby")===active[0].id,overflow:document.documentElement.scrollWidth-innerWidth};
 },meta.detailSelector);
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});const r=await read();assert(r.visible&&r.aria&&r.names.join("|")===expected.join("|")&&r.overflow<=1,"WIDTH_"+width);
  checks.push("WIDTH_"+width);
 }
 for(const name of expected){await page.getByRole("tab",{name,exact:true}).click();assert((await read()).selected[0]===name,"TAB_"+name);checks.push("TAB_"+name);}
 await page.getByRole("tab",{name:expected[0],exact:true}).focus();await page.keyboard.press("ArrowRight");assert((await read()).selected[0]===expected[1],"KEYBOARD");
 await page.getByRole("tab",{name:expected[2],exact:true}).click();const href=page.url();assert(new URL(href).searchParams.get("record")&&new URL(href).searchParams.get("tab")==="history","IMMUTABLE_URL");
 await page.reload({waitUntil:"domcontentloaded"});await tabs.first().waitFor();assert(page.url()===href&&(await read()).selected[0]===expected[2],"RELOAD");
 await page.getByRole("tab",{name:expected[1],exact:true}).click();await page.goBack();assert((await read()).selected[0]===expected[2],"BACK");await page.goForward();assert((await read()).selected[0]===expected[1],"FORWARD");
 assert(writes.length===0&&errors.length===0,"WRITES_OR_ERRORS");console.log("PAP1978_DETAIL_G4_PASS "+JSON.stringify({checks,keyboard:true,reload:true,history:true,writes:0,errors:0,sha:process.env.PAP1912_SERVED_SHA}));
}finally{if(page){await page.close();console.log("PAP1978_E2E_TAB_CLOSED");}if(browser)await browser.close();}
