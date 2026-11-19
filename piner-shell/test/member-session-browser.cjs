/* PAP-2194: isolated browser journey of actual UI + gateway against a synthetic BFF.
 * All network traffic intercepted. No live account, real credentials or real service.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const esbuild=require("esbuild");
const {chromium}=require("playwright");
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"pap2194-"));
 const origin="https://piner-review.invalid";
 const uiJs="/_next/static/chunks/pap2194-fixture.js",uiCss="/_next/static/css/pap2194-fixture.css";
 const {default:gateway}=await import("./../src/staging-worker.mjs");
 const results=[];
 let browser;
 try{
  await esbuild.build({stdin:{contents:[
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'import Form from "./app/piner-space/afterschool/login/AfterschoolPinForm";',
    'import {PinerAuthShell} from "./app/piner-space/afterschool/login/PinerAuthShell";',
    'createRoot(document.getElementById("root")).render(<PinerAuthShell><Form /></PinerAuthShell>);'
   ].join("\n"),resolveDir:process.cwd(),loader:"tsx"},bundle:true,jsx:"automatic",outdir:temp,entryNames:"ui",external:["/piner_mobile_shell_background.png"],loader:{".module.css":"local-css"},write:true});
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:"block"});
   try{
    let state="anonymous",failLogout=true,studentError=false;
    let students=[{id:"a",displayName:"Fixture Learner A",centers:[]},{id:"b",displayName:"Fixture Learner B",centers:[]}];
    const csrf="A".repeat(22),expiresAt="2099-01-01T00:00:00.000Z";
    const calls=[],errors=[];
    const data=(v,status=200)=>Response.json({data:v},{status});
    const service={async fetch(r){
      const p=new URL(r.url).pathname;
      if(p===uiJs||p===uiCss)return new Response(fs.readFileSync(path.join(temp,p===uiJs?"ui.js":"ui.css")),{headers:{"content-type":p===uiJs?"application/javascript":"text/css"}});
      if(p==="/piner-space/afterschool/login")return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+uiCss+'"><div id="root"></div><script src="'+uiJs+'"></script>',{headers:{"content-type":"text/html;charset=utf-8"}});
      if(!p.startsWith("/api/piner/afterschool/"))return new Response(null,{status:404});
      calls.push({path:p,method:r.method});
      if(p.endsWith("/pin/login")&&r.method==="POST"){
       state="restricted";return data({authState:"PIN_CHANGE_REQUIRED",expiresAt,csrfToken:csrf});
      }
      if(p.endsWith("/pin/change")&&r.method==="POST"&&state==="restricted"&&r.headers.get("x-pino-csrf")===csrf){
       state="authenticated";return data({authState:"AUTHENTICATED",expiresAt,csrfToken:csrf});
      }
      if(p.endsWith("/session")&&r.method==="GET")return state==="authenticated"?data({authenticated:true,expiresAt,csrfToken:csrf}):data(null,state==="restricted"?409:401);
      if(p.endsWith("/students")&&r.method==="GET")return state==="authenticated"?studentError?data(null,503):data(students):data(null,401);
      if(p.endsWith("/logout")&&r.method==="POST"&&state==="authenticated"&&r.headers.get("x-pino-csrf")===csrf){
       if(failLogout){failLogout=false;return data(null,503);}
       state="anonymous";return new Response(null,{status:204});
      }
      return data(null,401);
    }};
    const pixel=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yD5sAAAAASUVORK5CYII=","base64");
    const env={AFTERSCHOOL_PIN_WORKER:service,PINER_BRAND_R2:{async get(key){if(!/^piner_[a-z_]+\.png$/.test(key))return null;return{body:pixel,httpEtag:"fixture",writeHttpMetadata(h){h.set("Content-Type","image/png")}};}}};
    await ctx.route("**/*",async route=>{
      const r=route.request(),u=new URL(r.url());
      if(u.origin!==origin)return route.abort();
      const headers=new Headers(r.headers());
      // The fixture state is used only inside this isolated test transport.
      // No real browser/session cookie is read, stored or forwarded.
      if(state!=="anonymous")headers.set("cookie","__Host-PINO_AFTERSCHOOL=fixture-only");
      else headers.delete("cookie");
      headers.set("sec-fetch-site","same-origin");
      const req=new Request(r.url(),{method:r.method(),headers,...(r.postData()!==null?{body:r.postData()}: {})});
      const response=await gateway.fetch(req,env);
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));
    const visit=p=>page.goto(origin+p);
    const visible=sel=>page.locator(sel).waitFor({state:"visible"});
    await visit("/login");await visible('input[name=phone]');
    await page.locator('input[name=phone]').fill("0900000000");
    await page.getByRole("button",{name:"Tiếp tục",exact:true}).click();
    await page.locator('input[name=pin]').fill("000000");
    await page.getByRole("heading",{name:"Tạo PIN mới"}).waitFor();
    assert.equal(state,"restricted");assert.equal(new URL(page.url()).pathname,"/login");
    const denied=await gateway.fetch(new Request(origin+"/piner/house",{headers:{cookie:"__Host-PINO_AFTERSCHOOL=fixture-only","sec-fetch-site":"same-origin"}}),env);
    assert.doesNotMatch(await denied.text(),/data-member-session|Fixture Learner/);
    await page.locator('input[name=pin]').fill("111111");
    await page.locator('input[name=confirm]').fill("111111");
    await page.getByRole("button",{name:"Lưu PIN mới"}).click();
    await page.waitForURL(origin+"/");await visible("[data-member-session=true]");
    assert.equal(await page.locator(".program-card").count(),2);
    await page.locator('[data-launch-app=house]').click();
    await page.locator(".profile-switch").click();
    await page.locator('[data-student-id=b]').click();
    assert.match(await page.locator(".profile-switch").innerText(),/Fixture Learner B/);
    for(const tab of ["grid","reels","community","home"]){await page.locator("[data-tab="+tab+"]").click();assert.match(await page.locator(".profile-switch").innerText(),/Fixture Learner B/);}
    await page.reload();assert.match(await page.locator(".profile-switch").innerText(),/Fixture Learner B/);
    students=students.slice(0,1);await page.reload();
    assert.match(await page.locator(".profile-switch").innerText(),/Fixture Learner A/);
    studentError=true;await page.reload();assert.equal(await page.locator("[data-student-id]").count(),0);
    await page.locator(".profile-switch").click();await visible("[data-student-retry]");
    studentError=false;await page.locator("[data-student-retry]").click();
    assert.match(await page.locator(".profile-switch").innerText(),/Fixture Learner A/);
    await page.locator(".brand").click();await page.locator("[data-launch-app=mytime]").click();
    assert.equal(await page.locator("[data-student-id]").count(),0);
    assert.doesNotMatch(await page.locator("body").innerText(),/Fixture Learner/);
    await page.locator(".profile-switch").click();await page.locator("[data-sign-out]").click();
    await page.getByRole("alert").filter({hasText:"Chưa thể đăng xuất"}).waitFor();
    assert.equal(state,"authenticated");
    await page.locator("[data-sign-out]").click();await page.waitForURL(origin+"/login");
    await visible('input[name=phone]');assert.equal(state,"anonymous");
    await page.goBack();await page.reload();
    assert.equal(await page.locator("[data-member-session]").count(),0);
    assert.doesNotMatch(await page.locator("body").innerText(),/Fixture Learner/);
    assert.equal(calls.filter(x=>x.path.endsWith("/logout")).length,2);
    assert.deepEqual(errors,[]);
    results.push({width,pass:true,restrictedDenied:true,canonicalLoginHandoff:true,linkedSelection:true,retryAndLogout:true,anonymousAfterReload:true});
   }finally{await ctx.close();}
  }
 }finally{await browser?.close();fs.rmSync(temp,{recursive:true,force:true});console.log(JSON.stringify({scope:"LOCAL_MOCK_ONLY",results,browserClosed:true}));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
