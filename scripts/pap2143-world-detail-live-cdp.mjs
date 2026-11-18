/** PAP-2143 / PAP-1912: read-only authenticated native World Detail P0. */
import fs from "node:fs";
import {chromium} from "@playwright/test";
const e=process.env;
if(e.CI||e.PAP1912_DETAIL_G4!=="1")throw Error("PAP1912_LIVE_G4_NOT_AUTHORIZED");
for(const k of ["PAP1912_SERVED_SHA","PAP2143_CORE_SERVED_SHA"])if(!/^[a-f0-9]{40}$/.test(e[k]??""))throw Error("PAP1912_NO_INDEPENDENT_SERVED_SHA_DEPLOYMENT_EVIDENCE");
if(!e.PAP1912_DEPLOYMENT_ID||!e.PAP2143_CORE_DEPLOYMENT_ID)throw Error("PAP1912_NO_DEPLOYMENT");
const id=e.PAP2143_WORLD_ID??"";
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error("PAP2143_REQUIRE_APPROVED_SYNTHETIC_WORLD");
const c=JSON.parse(fs.readFileSync(new URL("../config/pap1912-detail-parity.json",import.meta.url),"utf8")).consumers.find(x=>x.jira==="PAP-2143");
if(!c||c.g4.surface!=="HO"||c.g4.authPort!==9337)throw Error("PAP2143_CONTRACT");
const origin="https://ho.staging.pinohouse.art",expected=c.tabs.map(x=>x[1]),writes=[],errors=[],checks=[];
const assert=(ok,msg)=>{if(!ok)throw Error("PAP2143_P0 "+msg)};
let browser,page;
try{
 browser=await chromium.connectOverCDP("http://127.0.0.1:9337",{timeout:12000});
 page=await browser.contexts()[0].newPage();page.setDefaultTimeout(15000);
 await page.route(origin+"/**",async route=>{if(["POST","PUT","PATCH","DELETE"].includes(route.request().method())){writes.push(new URL(route.request().url()).pathname);await route.abort()}else await route.continue()});
 page.on("pageerror",err=>errors.push(String(err)));
 await page.goto(origin+c.g4.route+"?record="+id+"&tab=overview",{waitUntil:"domcontentloaded"});
 const auth=await page.evaluate(async id=>{const r=await fetch("/api/ho/pinoria/worlds",{credentials:"include",cache:"no-store"});return r.ok&&(await r.json()).data?.worlds?.some(w=>w.id===id)},id);
 assert(auth,"AUTHENTICATED_WORLD");
 const tabs=page.locator("#detail-screen [role=tab]");await tabs.first().waitFor();
 const read=()=>page.evaluate(()=>{const root=document.querySelector("#detail-screen"),panel=root?.querySelector("[role=tabpanel]"),tabs=[...(root?.querySelectorAll("[role=tab]")??[])],active=tabs.filter(t=>t.getAttribute("aria-selected")==="true");return{names:tabs.map(t=>t.textContent.trim()),selected:active[0]?.textContent.trim(),aria:active.length===1&&document.getElementById(active[0].getAttribute("aria-controls"))===panel&&panel?.getAttribute("aria-labelledby")===active[0].id,overflow:document.documentElement.scrollWidth-innerWidth,visible:!!panel&&panel.getBoundingClientRect().height>0}});
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});const r=await read();assert(r.visible&&r.aria&&r.names.join("|")===expected.join("|")&&r.overflow<=1,"WIDTH_"+width);checks.push("WIDTH_"+width)}
 for(const name of expected){await page.getByRole("tab",{name,exact:true}).click();const r=await read();assert(r.selected===name&&r.aria,"TAB_"+name);checks.push("TAB_"+name)}
 await page.getByRole("tab",{name:expected[0],exact:true}).focus();await page.keyboard.press("ArrowRight");assert((await read()).selected===expected[1],"KEYBOARD");
 await page.getByRole("tab",{name:expected[2],exact:true}).click();const href=page.url();assert(new URL(href).searchParams.get("record")===id&&new URL(href).searchParams.get("tab")==="preview","DETAIL_URL");
 await page.reload({waitUntil:"domcontentloaded"});await tabs.first().waitFor();assert(page.url()===href&&(await read()).selected===expected[2],"RELOAD");
 await page.getByRole("tab",{name:expected[1],exact:true}).click();await page.goBack();await tabs.first().waitFor();assert((await read()).selected===expected[2],"BACK");await page.goForward();await tabs.first().waitFor();assert((await read()).selected===expected[1],"FORWARD");
 assert(!writes.length&&!errors.length,"WRITES_OR_ERRORS");
 console.log("PAP2143_READONLY_DETAIL_P0_PASS "+JSON.stringify({checks,keyboard:true,reload:true,backForward:true,writes:0,errors:0,sha:e.PAP1912_SERVED_SHA,coreSha:e.PAP2143_CORE_SERVED_SHA}));
}finally{if(page){await page.close();console.log("PAP2143_E2E_TAB_CLOSED")}if(browser)await browser.close()}
