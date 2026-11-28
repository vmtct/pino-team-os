/** PAP-1612: future real-record, read-only G4 Detail check; never synthetic M1 evidence. */
import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
if(process.env.CI||process.env.PAP1912_DETAIL_G4!=="1")throw Error("PAP1612_LIVE_G4_NOT_AUTHORIZED");
const center=process.env.PAP1612_REAL_CENTER_ID??"",id=process.env.PAP1612_REAL_SESSION_ID??"",actor=process.env.PAP1612_MANAGER_USER_ID??"",sha=process.env.PAP1912_SERVED_SHA??"",deployment=process.env.PAP1912_DEPLOYMENT_ID??"",port=Number(process.env.PAP1612_QA_PORT);
assert(uuid.test(center)&&uuid.test(id)&&uuid.test(actor)&&/^[a-f0-9]{40}$/i.test(sha)&&deployment&&[9342,9343,9344].includes(port),"PAP1612_REAL_SCOPE_AND_SERVING_PROOF_REQUIRED");
const origin="https://bo.staging.pinohouse.art";
const browser=await chromium.connectOverCDP("http://127.0.0.1:"+port,{timeout:15000});
let page;
try{
 page=await browser.contexts()[0].newPage();
 await page.route("**/*",r=>["GET","HEAD"].includes(r.request().method())?r.continue():r.abort());
 await page.goto(origin+"/bo/workforce/timekeeping?centerId="+encodeURIComponent(center),{waitUntil:"domcontentloaded",timeout:25000});
 assert.equal(new URL(page.url()).origin,origin);
 const scope=await page.evaluate(async({center,id,actor})=>{
  const get=async p=>{const r=await fetch(p,{cache:"no-store",credentials:"same-origin",redirect:"error"});if(r.status!==200)throw Error("Scoped read denied");return (await r.json()).data;};
  const principal=await get("/api/bo/context");
  const centers=await get("/api/bo/workforce/timekeeping/centers");
  const sessions=await get("/api/bo/workforce/timekeeping?"+new URLSearchParams({centerId:center,limit:"100"}));
  return principal.userId===actor&&principal.surface==="BO"&&principal.entitled===true&&principal.permissionKeys?.includes("staff.timekeeping.view")&&centers.some(c=>c.id===center)&&sessions.data.some(r=>r.id===id&&r.centerId===center);
 },{center,id,actor});
 assert.equal(scope,true,"PAP1612_REAL_RECORD_SCOPE_NOT_VERIFIED");
 // Live evidence entry is deliberately absent in M1. Do not substitute the synthetic review.
 const evidence=page.getByRole("button",{name:"B\u1eb1ng ch\u1ee9ng check-in",exact:true});
 await evidence.waitFor({state:"visible",timeout:10000});await evidence.click();
 const row=page.locator("table tbody tr").filter({hasText:id});
 assert.equal(await row.count(),1,"PAP1612_REAL_EVIDENCE_ROW_NOT_VERIFIED");
 await row.click();
 await page.getByRole("button",{name:"Full Detail",exact:true}).click();
 const detail=page.locator('[data-tdd-shell="detail"]');await detail.waitFor({state:"visible",timeout:10000});
 assert((await detail.innerText()).includes(id),"Real record identity not verified");
 const labels=["Th\u00f4ng tin","\u1ea2nh b\u1eb1ng ch\u1ee9ng","L\u1ecbch s\u1eed"];
 assert.deepEqual(await detail.getByRole("tab").allTextContents(),labels);
 for(const name of labels){const tab=detail.getByRole("tab",{name,exact:true});await tab.click();assert.equal(await tab.getAttribute("aria-selected"),"true");await detail.getByRole("tabpanel").waitFor({state:"visible"});}
 console.log(JSON.stringify({sha,deployment,detailReadback:"PASS",businessG4:"NOT_RUN"}));
}finally{await page?.close();await browser.close();}
