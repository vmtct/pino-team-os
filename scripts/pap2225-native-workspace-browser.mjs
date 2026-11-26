// PAP-2225 offline synthetic mounted native workspace QA, never G4.
import {build} from "esbuild";
import {chromium} from "playwright";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const out=resolve(process.argv[2]??".next/pap2225-mounted-evidence"),bundle=resolve(out,"fixture.js");
await mkdir(out,{recursive:true});
const result={scope:"isolated actual provider and shared native workspace; no live transport",checks:[],browserClosed:false};
let browser,page;
const origin="https://running-class.invalid";
try{
 await build({entryPoints:["scripts/fixtures/pap2225-native-workspace-entry.tsx"],outfile:bundle,bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"synthetic-next",setup(b){b.onResolve({filter:/^next\/(link|navigation|image|dynamic)$/},args=>({path:args.path,namespace:"synthetic"}));b.onLoad({filter:/.*/,namespace:"synthetic"},({path})=>({loader:"jsx",resolveDir:process.cwd(),contents:path==="next/image"?"import React from 'react';export default function Image(p){return <img {...p}/>}" :path==="next/dynamic"?"export default function dynamic(){return function Unused(){return null}}":"import React from 'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export default function Link(p){return <a {...p}/>}"}));}}]});
 browser=await chromium.launch({headless:true});
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
  const lost=width===390,errors=[],network=[];
  try{
   await ctx.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.origin===origin&&r.request().method()==="GET"){
     if(u.pathname==="/bo/running-classes")return r.fulfill({status:200,contentType:"text/html",body:'<!doctype html><html lang="vi" data-bo-ui-authority="v25"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>'});
     if(["/fixture.js","/fixture.css"].includes(u.pathname))return r.fulfill({status:200,contentType:u.pathname.endsWith(".js")?"text/javascript":"text/css",body:await readFile(resolve(out,u.pathname.slice(1)))});
    }
    network.push(r.request().method()+" "+u.pathname);return r.abort();
   });
   page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));
   await page.goto(origin+"/bo/running-classes"+(lost?"?lost=1":""),{waitUntil:"domcontentloaded"});
   await page.locator("#add-record").click({timeout:20000});
   await page.locator("#rc-operationalName").fill("QA Running Class");
   await page.locator("#rc-pathProgramId").selectOption({label:"Piano"});
   await page.locator("#rc-learningSpaceId").selectOption({label:"QA Room"});
   await page.locator("#rc-windowStartsLocal").fill("18:00");
   await page.locator("#rc-windowEndsLocal").fill("19:30");
   await page.locator("#rc-optimalConcurrentCapacity").fill("8");
   await page.screenshot({path:resolve(out,width+"-create.png"),fullPage:true});
   await page.locator("#create-save").click();
   if(lost){const recovery=page.getByRole("button",{name:"Kiểm tra lại thao tác"});await recovery.waitFor();assert.equal(await page.locator("#add-record").count(),0);await recovery.click();}
   await page.locator("#full-detail").waitFor({timeout:15000});
   await page.screenshot({path:resolve(out,width+"-drawer.png"),fullPage:true});
   await page.locator("#full-detail").click();
   await page.locator("#rc-operationalName").fill("QA Running Class revised");await page.locator("#rc-operationalName").press("Enter");
   await page.waitForFunction(()=>JSON.parse(document.querySelector("#synthetic-receipt").textContent).version===2);
   await page.locator("#rc-status").selectOption("ACTIVE");
   await page.waitForFunction(()=>JSON.parse(document.querySelector("#synthetic-receipt").textContent).version===3);
   const receipt=JSON.parse(await page.locator("#synthetic-receipt").textContent());
   assert.equal(receipt.createCalls,lost?2:1);assert.equal(receipt.editCalls,2);assert.equal(receipt.status,"ACTIVE");assert.equal(receipt.name,"QA Running Class revised");
   assert.equal(errors.length,0,errors.join(";"));assert.equal(network.filter(x=>!x.startsWith("GET ")).length,0);
   await page.screenshot({path:resolve(out,width+"-detail.png"),fullPage:true});
   result.checks.push({width,lostCreateRecovery:lost,receipt,blockedNetwork:network});
  }catch(e){if(page&&!page.isClosed()){result.diagnostic=(await page.locator("body").innerText()).slice(0,2000);await page.screenshot({path:resolve(out,width+"-failure.png"),fullPage:true});}throw e;}
  finally{await ctx.close();}
 }
 result.pass=true;
}catch(e){result.pass=false;result.error=String(e);process.exitCode=1;}
finally{if(browser){await browser.close();result.browserClosed=true;}await writeFile(resolve(out,"result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
