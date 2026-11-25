/** PAP-2337 / PNR-APP-HUB — authenticated real-record Detail readback only; M3 opt-in. */
import {chromium} from "@playwright/test";
const id=process.env.PAP2337_REAL_POST_ID??"",sha=process.env.PAP2337_SERVED_SHA??"",deployment=process.env.PAP2337_DEPLOYMENT_ID??"";
if(process.env.CI||process.env.PAP2337_DETAIL_G4!=="1")throw Error("PAP2337_G4_NOT_AUTHORIZED");
if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||!/^[0-9a-f]{40}$/i.test(sha)||!deployment)throw Error("PAP2337_REAL_RECORD_AND_SERVING_PROOF_REQUIRED");
for(const [surface,port,route] of [["bo",9335,"/bo/piner-posts"],["ho",9337,"/ho/content/post-approval"]]){
 const browser=await chromium.connectOverCDP("http://127.0.0.1:"+port,{timeout:12000});let page;
 try{
  page=await browser.contexts()[0].newPage();await page.route("**/*",r=>["GET","HEAD"].includes(r.request().method())?r.continue():r.abort());
  await page.goto("https://"+surface+".staging.pinohouse.art"+route+"?record="+encodeURIComponent(id),{waitUntil:"domcontentloaded",timeout:25000});
  const root=page.locator('[data-tdd-shell="detail"]');await root.waitFor({state:"visible",timeout:15000});
  const result=await root.evaluate((node,expected)=>({record:node.textContent?.includes(expected),mock:node.textContent?.includes("POST-MOCK-"),tabs:[...node.querySelectorAll('[role="tab"]')].map(t=>t.textContent?.trim())}),id);
  if(!result.record||result.mock||result.tabs[0]!=="Tổng quan"||result.tabs.at(-1)!=="Lịch sử")throw Error("Real Post Detail parity not verified: "+surface);
  console.log(JSON.stringify({surface,sha,deployment,detailReadback:"PASS",businessG4:"NOT_RUN"}));
 }finally{await page?.close();await browser.close();}
}
