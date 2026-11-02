/**
 * PAP-1050 authenticated BO runtime-owner E2E, read-only.
 * Usage (authorized i5 Windows Node):
 *   BO_E2E_CDP_PORT=9335 node scripts/e2e-bo-runtime-owner.mjs
 * The script only creates/closes its OWN tabs; never reads credentials or writes Core.
 * Exit 1 when the canonical marker, approved Create form, URL or responsive state diverges.
 */
import {chromium} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const port=Number(process.env.BO_E2E_CDP_PORT||9335);
const target=process.env.BO_E2E_URL||"https://bo.staging.pinohouse.art/bo?module=subscriptions";
const evidence=process.env.BO_E2E_EVIDENCE_DIR||path.resolve("evidence","bo-runtime-owner-e2e");
const report=[];
let browser;
try{
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port,{timeout:20000});
 const ctx=browser.contexts()[0];
 if(!ctx)throw Error("No authorized CDP browser context");
 fs.mkdirSync(evidence,{recursive:true});
 for(const width of [1440,768,390]){
  const p=await ctx.newPage();
  try{
   await p.setViewportSize({width,height:900});
   const writes=[];
   await p.route("**/api/**",route=>{
    const method=route.request().method();
    if(!["GET","HEAD","OPTIONS"].includes(method)){writes.push(method+" "+route.request().url());return route.abort();}
    return route.continue();
   });
   const errors=[];p.on("pageerror",e=>errors.push(e.message));
   await p.goto(target,{waitUntil:"domcontentloaded",timeout:30000});
   await p.locator('[data-bo-runtime-surface="subscriptions-core"]').waitFor({timeout:20000});
   if(p.url().includes("/staff-login"))throw Error("FC port "+port+" is not authenticated");
   if(await p.locator("body").innerText().then(s=>s.includes("Tạo Subscriptions")))throw Error("Legacy generic surface visible before Create");
   const marker=p.locator('[data-bo-runtime-surface="subscriptions-core"]');
   const table=marker.locator("table");
   await table.waitFor({timeout:16000});
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   if(overflow>2)throw Error("Document overflow "+overflow+"px");
   await p.screenshot({path:path.join(evidence,"subscription-table-"+width+".png"),fullPage:true});
   await marker.getByRole("button",{name:/Tạo mới/}).click();
   const search=p.locator('#subscription-create-student-search');
   await search.waitFor({timeout:8000});
   const dialog=p.locator('[role="dialog"]').filter({has:search});
   const body=await dialog.innerText();
   if(!body.includes("Tạo Subscription"))throw Error("Unexpected create drawer title");
   // Linked prices and dates load after selecting a Student; do not issue a real Sale.
   if(await dialog.locator('input[type="password"]').count())throw Error("Unexpected login form in Create");
   if(writes.length)throw Error("Mutation attempted: "+writes.join("; "));
   await p.screenshot({path:path.join(evidence,"subscription-create-"+width+".png"),fullPage:true});
   if(errors.length)throw Error("Page JS errors: "+errors.slice(0,2).join("; "));
   report.push({width,status:"PASS",url:p.url(),marker:"subscriptions-core",studentSearch:await search.count(),overflow});
  }catch(error){
   report.push({width,status:"FAIL",error:String(error),url:p.url()});
   await p.screenshot({path:path.join(evidence,"failure-"+width+".png"),fullPage:true}).catch(()=>{});
   break;
  }finally{await p.close();}
 }
}finally{if(browser)await browser.close();}
fs.mkdirSync(evidence,{recursive:true});
fs.writeFileSync(path.join(evidence,"result.json"),JSON.stringify({port,target,report},null,2));
console.log(JSON.stringify({port,target,report},null,2));
if(report.length!==3||report.some(r=>r.status!=="PASS"))process.exitCode=1;
