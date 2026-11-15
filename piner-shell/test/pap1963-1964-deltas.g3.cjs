"use strict";
// PAP-1963 + PAP-1964 / PNR-APP-HUB — stable baseline via original CSS overrides.
// No real user identity, no production write, Chrome headless closes in finally.
const {chromium}=require(process.env.PINER_PLAYWRIGHT_CORE||"playwright-core");
const {pathToFileURL}=require("node:url");
const fs=require("node:fs"),path=require("node:path");
const BASE=process.env.PINER_SHELL_BASE||"https://app.staging.pinohouse.art";
const LOCAL=process.env.PINER_TEST_LOCAL==="1";
const WIDTHS=[320,390,430,768,1024,1440,1920];
const outDir=path.resolve(__dirname,"../evidence");
const assert=(condition,why)=>{if(!condition)throw new Error(why)};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",args:["--disable-extensions"]});
 const context=await browser.newContext();
 const page=await context.newPage();
 let pass=0;
 try{
  if(LOCAL){
   const root=path.resolve(__dirname,"../src");
   const [{renderHtml},{parseRoute,getShellAdapter},{CSS}]=await Promise.all([
    import(pathToFileURL(path.join(root,"view.mjs")).href),
    import(pathToFileURL(path.join(root,"adapter.mjs")).href),
    import(pathToFileURL(path.join(root,"styles.mjs")).href)
   ]);
   const html=renderHtml(parseRoute("/"),getShellAdapter());
   await page.route("**/*",route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==="/")return route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
    if(pathname==="/piner-shell.css")return route.fulfill({status:200,contentType:"text/css; charset=utf-8",body:CSS});
    return route.continue();
   });
  }
  const measure=()=>page.evaluate(()=>{
   const style=e=>parseFloat(getComputedStyle(e).fontSize);
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,center:r.x+r.width/2}};
   const strong=document.querySelector(".program-card.house .card-copy strong");
   const pino=strong.querySelector(".pino-word"),after=strong.querySelector(".afterschool-word");
   const sigil=document.querySelector(".launch-sigil"),wordmark=document.querySelector(".launch-wordmark");
   const brand=document.querySelector(".launch-brand"),mytime=document.querySelector(".mytime .card-copy strong");
   const cards=[...document.querySelectorAll(".program-card")];
   return {titleParent:style(strong),pino:style(pino),after:style(after),
    sigil:box(sigil),wordmark:box(wordmark),brand:box(brand),mytime:style(mytime),
    cards:cards.map(box),overflow:document.documentElement.scrollWidth>innerWidth+1,
    shell:box(document.querySelector(".phone")),viewport:innerHeight,
    logoOk:sigil.complete&&sigil.naturalWidth>0,wordmarkOk:wordmark.complete&&wordmark.naturalWidth>0};
  });
  for(const w of WIDTHS){
   await page.setViewportSize({width:w,height:w===320?720:850});
   const response=await page.goto(BASE+"/",{waitUntil:"networkidle",timeout:30000});
   assert(response?.status()===200,"launcher unavailable at "+w);
   await page.waitForFunction(()=>[...document.querySelectorAll(".launch-brand img")].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:18000});
   // PAP-1969: capture the previous Live (PAP-1963) font-size under the same
   // viewport using CSSOM only; preserving the production CSP.
   const previousAfterschool=await page.evaluate(()=>{
    const el=document.querySelector(".house .card-copy strong .afterschool-word");
    el.style.setProperty("font-size","calc(.4244em - 2px)","important");
    return parseFloat(getComputedStyle(el).fontSize);
   });   // CSP on the actual Worker forbids injecting <style>. CSSOM property writes
   // from Playwright's debugger context model the PAP-1962 baseline without
   // changing the deployed stylesheet or weakening style-src.
   await page.evaluate(()=>{
    document.querySelector(".pino-word").style.setProperty("font-size","1em","important");
    document.querySelector(".afterschool-word").style.setProperty("font-size",".4244em","important");
    document.querySelector(".launch-sigil").style.setProperty("width","30px","important");
    document.querySelector(".launch-sigil").style.setProperty("height","30px","important");
    document.querySelector(".launch-wordmark").style.setProperty("width","clamp(136px,41.3%,175px)","important");
   });
   const base=await measure();
   await page.reload({waitUntil:"networkidle",timeout:30000});
   const updated=await measure();
   const diffs={width:w,
    pinoPx:updated.pino-base.pino,afterPx:updated.after-base.after,
    sigilWidthRatio:updated.sigil.w/base.sigil.w,
    sigilHeightRatio:updated.sigil.h/base.sigil.h,
    wordmarkWidthRatio:updated.wordmark.w/base.wordmark.w};
   console.log("PAP1963_1964_DELTA "+JSON.stringify(diffs));
   assert(Math.abs(diffs.pinoPx-2)<.05,"PINO not +2px "+JSON.stringify(diffs));
   assert(Math.abs(diffs.afterPx+1)<.05,"Afterschool should be -1px vs PAP-1962 baseline "+JSON.stringify(diffs));
   assert(Math.abs(updated.after-previousAfterschool-1)<.05,"PAP-1969 Afterschool not +1px vs previous Live "+JSON.stringify({width:w,previousAfterschool,newFontSize:updated.after}));
   assert(Math.abs(diffs.sigilWidthRatio-1.5)<.005&&Math.abs(diffs.sigilHeightRatio-1.5)<.005,
    "Logo not +50% "+JSON.stringify(diffs));
   assert(Math.abs(diffs.wordmarkWidthRatio-.8)<.005,"Piner APP wordmark not -20% "+JSON.stringify(diffs));
   assert(Math.abs(base.mytime-updated.mytime)<.01,"MyTime typography drift "+w);
   assert(!updated.overflow&&updated.shell.w===Math.min(w,430),"Shell overflow "+w);
   assert(Math.abs(updated.sigil.center-updated.brand.center)<1&&Math.abs(updated.wordmark.center-updated.brand.center)<1,
    "Centered branding drift "+w);
   for(const card of updated.cards){
    assert(card.right<=updated.shell.right+1&&card.bottom<=updated.viewport+2,"Card overflow "+w+" "+JSON.stringify(card));
   }
   if(w===390){
    fs.mkdirSync(outDir,{recursive:true});
    await page.screenshot({path:path.join(outDir,"pap1963-1964-"+(LOCAL?"local":"staging")+"-390.png")});
   }
   pass++;
  }
  console.log("PAP1963_1964_G3_PASS "+pass+"/"+WIDTHS.length+" HTML-only, isolated, no writes");
 }finally{
  await context.close();await browser.close();console.log("PAP1963_1964_CHROME_CLOSED");
 }
})().catch(err=>{console.error("PAP1963_1964_G3_FAIL "+(err.stack||err));process.exitCode=1});
