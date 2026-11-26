// PAP-2365 / PLT-PRODUCT-PLAN isolated browser proof. No actual network.
import {build} from "esbuild";
import {chromium} from "playwright";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const out=resolve(process.argv[2]??".next/pap2365-native-evidence");
await mkdir(out,{recursive:true});
await build({entryPoints:["scripts/fixtures/pap2365-native-product-plan-entry.tsx"],outfile:resolve(out,"fixture.js"),bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"synthetic-next",setup(b){b.onResolve({filter:/^next\/(link|navigation|image|dynamic)$/},args=>({path:args.path,namespace:"synthetic"}));b.onLoad({filter:/.*/,namespace:"synthetic"},({path})=>({loader:"jsx",resolveDir:process.cwd(),contents:path==="next/image"?"import React from 'react';export default function Image(p){return <img {...p}/>}":path==="next/dynamic"?"export default function dynamic(){return function Unused(){return null}}":"import React from 'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export default function Link(p){return <a {...p}/>}"}));}}]});
const origin="https://ho.staging.pinohouse.art",route="/ho/billing/product-plans",id="01900000-0000-7000-8000-000000000001";
const result={scope:"offline synthetic actual native Product Plan TDD; not G4",checks:[],browserClosed:false};
let browser,page;
async function open(width,query){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
 await context.route("**/*",async r=>{
 const u=new URL(r.request().url());
 if(u.origin!==origin||r.request().method()!=="GET")return r.abort();
 if(u.pathname===route)return r.fulfill({status:200,contentType:"text/html",body:'<!doctype html><html lang="vi" data-surface="ho"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>'});
 if(u.pathname==="/fixture.js"||u.pathname==="/fixture.css")return r.fulfill({status:200,contentType:u.pathname.endsWith(".js")?"text/javascript":"text/css",body:await readFile(resolve(out,u.pathname.slice(1)))});
 return r.abort();
 });
 page=await context.newPage();await page.goto(origin+route+query,{waitUntil:"domcontentloaded"});return page;
}
const receipt=()=>page.locator("#synthetic-receipt").textContent().then(JSON.parse);
const edit=async(value)=>{
 const field=page.locator('[data-tdd-direct-field="name"] input');
 await field.waitFor({timeout:20000});await field.fill(value);await field.press("Enter");
};
try{
 browser=await chromium.launch({headless:true});
 for(const width of [390,1440]){
 await open(width,"");await page.getByText("Gói QA Synthetic",{exact:true}).first().waitFor({timeout:20000});await page.screenshot({path:resolve(out,width+"-table.png"),fullPage:true});assert.equal((await receipt()).writes,0);
 await page.getByRole("row",{name:"Mở Quick View Gói QA Synthetic",exact:true}).press("Enter");await page.locator("#full-detail").waitFor();assert.equal(await page.locator("[data-tdd-direct-field]").count(),6);await page.screenshot({path:resolve(out,width+"-drawer.png"),fullPage:true});
 const cancelled=page.locator('[data-tdd-direct-field="name"] input');await cancelled.fill("Cancelled draft");await cancelled.press("Escape");assert.equal(await cancelled.inputValue(),"Gói QA Synthetic");assert.equal((await receipt()).writes,0);
 await page.locator("#full-detail").click();await page.waitForURL("**?record="+id);await page.locator('[data-tdd-direct-field="name"] input').waitFor();
 let n=0;for(const [key,value,wire,expected] of [["name","Gói QA Six","displayName","Gói QA Six"],["cadence","3","cadence",3],["termWeeks","24","termWeeks",24],["price","200000","listPriceMinor",200000],["badge","HERO","badge","HERO"],["enabled","false","enabled",false]]){
 const control=page.locator('[data-tdd-direct-field="'+key+'"] '+(["badge","enabled"].includes(key)?"select":"input"));await control.waitFor();if(["badge","enabled"].includes(key))await control.selectOption(value);else{await control.fill(value);await control.press("Enter");}n++;await page.waitForFunction(count=>JSON.parse(document.querySelector("#synthetic-receipt").textContent).writes===count,n);await control.waitFor();await page.waitForFunction(({key,value})=>document.querySelector('[data-tdd-direct-field="'+key+'"] input,[data-tdd-direct-field="'+key+'"] select')?.value===value,{key,value});assert.equal((await receipt()).row[wire],expected);}
 assert.equal((await receipt()).row.version,7);assert.equal((await receipt()).row.purchasedUnits,72);assert.equal((await receipt()).row.updatedByUserId,"01900000-0000-7000-8000-000000000002");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
 const invalid=page.locator('[data-tdd-direct-field="termWeeks"] input');await invalid.fill("13");await invalid.press("Enter");await page.locator('[data-tdd-direct-field="termWeeks"] [role="alert"]').waitFor();assert.equal((await receipt()).writes,6);await page.context().close();
 await open(width,"?record="+id+"&stale=1");await edit("Stale draft");await page.getByText("Bản ghi đã thay đổi. Đang tải lại dữ liệu.",{exact:true}).waitFor();assert.equal((await receipt()).writes,0);assert.equal((await receipt()).row.version,2);await page.context().close();
 await open(width,"?record="+id);
 await edit("Gói QA Updated");
 await page.waitForFunction(()=>JSON.parse(document.querySelector("#synthetic-receipt").textContent).writes===1);
 await page.locator('[data-tdd-direct-field="name"] input').waitFor();await page.waitForFunction(()=>document.querySelector('[data-tdd-direct-field="name"] input')?.value==="Gói QA Updated");
 assert.equal((await receipt()).row.version,2);
 await page.screenshot({path:resolve(out,width+"-detail.png"),fullPage:true});
 await page.getByRole("tab",{name:"Subscription",exact:true}).click();await page.getByText("QA Student 100",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Trang tiếp",exact:true}).click();await page.getByText("QA Student 125",{exact:true}).waitFor();
 await page.screenshot({path:resolve(out,width+"-subscriptions.png"),fullPage:true});await page.getByRole("button",{name:"Trang đầu",exact:true}).click();await page.getByText("QA Student 100",{exact:true}).waitFor();
 await page.getByRole("tab",{name:"Lịch sử",exact:true}).click();const audit=page.locator('[data-audit-subject="'+id+'"]');await audit.first().waitFor();assert.equal(await audit.count(),25);assert.equal(await audit.first().locator(".v25-audit-outcome").textContent(),"Thành công");await audit.first().getByText("Gói QA Synthetic",{exact:true}).waitFor();await audit.first().getByText("Gói QA Updated",{exact:true}).waitFor();await page.getByRole("button",{name:"Trang lịch sử tiếp",exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll("[data-audit-subject]").length===1);await page.getByRole("button",{name:"Trang lịch sử đầu",exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll("[data-audit-subject]").length===25);await page.screenshot({path:resolve(out,width+"-history.png"),fullPage:true});await page.context().close();
 await open(width,"?record="+id+"&lost=1");await edit("Gói QA Lost");
 await page.getByRole("button",{name:"Kiểm tra lại",exact:true}).waitFor();
 assert.equal((await receipt()).writes,1);await page.reload();await page.getByRole("button",{name:"Kiểm tra lại",exact:true}).waitFor();await page.getByRole("button",{name:"Kiểm tra lại",exact:true}).click();
 await page.locator('[data-tdd-direct-field="name"] input').waitFor();assert.equal((await receipt()).writes,1);await page.context().close();
 await open(width,"?record="+id+"&reader=1");await page.getByText("Gói QA Synthetic",{exact:true}).first().waitFor();assert.equal(await page.locator("[data-tdd-direct-field]").count(),0);assert.equal((await receipt()).writes,0);await page.context().close();
 result.checks.push({width,table:true,drawer:true,detail:true,allSixFields:true,escapeNoWrite:true,invalidTerm:true,staleCas:true,save:true,subscriptionPaging:true,history:true,lostAckRecovery:true,reader:true});
 }
 result.pass=true;
}catch(e){result.pass=false;result.error=String(e);if(page&&!page.isClosed()){result.syntheticText=(await page.locator("body").innerText()).slice(0,3000);await page.screenshot({path:resolve(out,"failure.png"),fullPage:true});}process.exitCode=1;}
finally{if(browser){await browser.close();result.browserClosed=true;}await writeFile(resolve(out,"result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
