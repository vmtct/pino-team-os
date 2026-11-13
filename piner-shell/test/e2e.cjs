"use strict";
// PAP-1943 / PNR-APP-HUB — G3 preview acceptance, real Cloudflare Worker/R2 binding.
const {chromium}=require("playwright-core");
const fs=require("fs"),path=require("path");
const BASE=process.env.PINER_SHELL_BASE||"https://piner-app-shell-pap1943.minhtri-van42.workers.dev";
const evidence=path.join(__dirname,"..","evidence");
fs.mkdirSync(evidence,{recursive:true});
const report={base:BASE,cases:[],errors:[],writes:[],screenshots:[]};
const ok=(v,m)=>{if(!v)throw Error(m)};
(async()=>{
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--disable-extensions"]});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
 page.on("pageerror",e=>report.errors.push("JS "+e.message));
 page.on("console",m=>{if(m.type()==="error"&&!m.text().includes("favicon.ico"))report.errors.push("Console "+m.text().slice(0,210))});
 page.on("request",r=>{if(!["GET","HEAD","OPTIONS"].includes(r.method()))report.writes.push(r.method()+" "+r.url())});
 async function go(url){const r=await page.goto(BASE+url,{waitUntil:"domcontentloaded"});ok(r?.status()===200,url+" HTTP "+r?.status());await page.locator('[data-piner-shell="pap1943"]').waitFor();}
 function viewSize(w){return {width:w,height:w===320?640:w===390?844:900}}
 async function checkLauncher(w){
  await page.setViewportSize(viewSize(w));await go("/");
  await page.locator(".program-card").first().waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll(".launch-brand img")].length===2&&[...document.querySelectorAll(".launch-brand img")].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000});
  const d=await page.evaluate(()=>{
   const phone=document.querySelector(".phone"),cards=[...document.querySelectorAll(".program-card")],get=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
   return {shell:get(phone),bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,cards:cards.map(c=>({href:c.getAttribute("href"),rect:get(c),photo:get(c.querySelector(".card-photo")),gradient:getComputedStyle(c.querySelector(".card-fade")).backgroundImage,background:getComputedStyle(c.querySelector(".card-photo")).backgroundImage}))};
  });
  ok(!d.bodyOverflow&&d.shell.w===Math.min(w,430),"launcher width overflow "+w);
  ok(d.cards.length===2&&d.cards[0].href==="/piner/house"&&d.cards[1].href==="/piner/mytime","launcher links "+w);
  for(const [i,c] of d.cards.entries()){
   ok(c.rect.right<=d.shell.right+1&&c.rect.bottom<=viewSize(w).height+1,"card below fold "+w+" "+i+" bottom "+c.rect.bottom);
   ok(Math.abs(c.photo.x-c.rect.x-c.rect.w*.1)<1.2,"photo shift +10% "+w+" "+i);
   ok(/0\) 33%/.test(c.gradient),"gradient transparent at 33% "+w+" "+c.gradient);
   ok(c.background.includes(i===0?"piner_journey_background.png":"piner_mytime_background.png"),"R2 image "+w+" "+i);
  }
  if(w===390){const f=path.join(evidence,"launcher-390-preview.png");await page.screenshot({path:f});report.screenshots.push(f);}
  report.cases.push({kind:"launcher",width:w,pass:true});
 }
 async function checkMember(w,space){
  await page.setViewportSize(viewSize(w));await go("/piner/"+space);
  await page.waitForFunction(()=>[...document.querySelectorAll(".brand img")].length===2&&[...document.querySelectorAll(".brand img")].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000});
  const props=await page.evaluate(()=>{
   const phone=document.querySelector(".phone"),section=document.querySelector(".member"),brand=section.querySelector(".brand"),button=section.querySelector(".profile-switch"),main=section.querySelector(".scroll-content"),nav=section.querySelector(".bottom-nav");
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height}};
   return {shell:box(phone),brand:box(brand),sigil:box(brand.querySelector(".sigil")),wordmark:box(brand.querySelector(".wordmark")),switcher:box(button),mainHeight:main.clientHeight,scrollMax:main.scrollHeight-main.clientHeight,navCount:nav.querySelectorAll("a").length,adapter:main.querySelector("[data-adapter-state]").getAttribute("data-adapter-state"),noOverflow:document.documentElement.scrollWidth<=innerWidth+1};
  });
  ok(props.shell.width===Math.min(w,430)&&props.noOverflow,"member mobile max430 "+space+" "+w);
  ok(props.brand.right<=props.switcher.x+1,"brand left/switch right "+space+" "+w);
  ok(Math.abs(props.sigil.height-props.wordmark.height)<.7,"canonical brand equal height "+space+" "+w);
  ok(props.adapter==="unauthenticated"&&props.navCount===4&&props.scrollMax>150,"FE-only no data + nav "+space+" "+w);
  ok((await page.locator(".profile-switch").innerText()).includes(space==="house"?"Chọn hồ sơ":"Tài khoản"),"switch label "+space);
  await page.locator(".profile-switch").click();
  ok(await page.locator(".profile-panel").isVisible(),"switch menu "+space+" "+w);
  await page.keyboard.press("Escape");ok(!(await page.locator(".profile-panel").isVisible()),"Escape dismisses "+space+" "+w);
  await page.locator(".profile-switch").evaluate(e=>e.blur()); // Touch-scroll case: no keyboard-focused chrome.
  const main=page.locator(".scroll-content");
  await main.evaluate(el=>el.scrollBy({top:260,behavior:"instant"}));
  await page.locator('.member[data-chrome-collapsed="true"]').waitFor({timeout:6000});
  await page.waitForTimeout(300);
  const collapsed=await page.evaluate(()=>{const s=document.querySelector(".member");return {top:s.querySelector(".app-header").inert,bottom:s.querySelector(".bottom-nav").inert,client:s.querySelector(".scroll-content").clientHeight}});
  ok(collapsed.top&&collapsed.bottom&&collapsed.client>=props.mainHeight+70,"scroll hide frees height "+space+" "+w);
  if(w===390){const f=path.join(evidence,space+"-collapsed-390-preview.png");await page.screenshot({path:f});report.screenshots.push(f);}
  await main.evaluate(el=>el.scrollBy({top:-105,behavior:"instant"}));
  await page.locator('.member[data-chrome-collapsed="false"]').waitFor({timeout:6000});
  ok(!(await page.locator(".app-header").evaluate(e=>e.inert))&&!(await page.locator(".bottom-nav").evaluate(e=>e.inert)),"scroll up reveals "+space+" "+w);
  if(w===390){const f=path.join(evidence,space+"-member-390-preview.png");await page.screenshot({path:f});report.screenshots.push(f);}
  await go("/piner/"+space+"/community");
  ok((await page.locator(".feed-inner h1").count())===0,"Community redundant heading "+space);
  ok(await page.locator('nav.bottom-nav a[aria-current="page"]').getAttribute("data-tab")==="community","scoped active tab "+space);
  ok(await page.locator('[data-adapter-state="unauthenticated"]').count()===1,"no fake public data "+space);
  report.cases.push({kind:"member",space,width:w,pass:true});
 }
 try{
  for(const w of [320,390,768,1024,1440,1920]){
   await checkLauncher(w);
   for(const sp of ["house","mytime"])await checkMember(w,sp);
  }
  const paths=["/piner/public","/piner/public/post/a2","/api/piner/context"];
  for(const p of paths){const r=await page.request.get(BASE+p);ok(r.status()===404,"deny "+p+" got "+r.status());}
  const write=await page.request.post(BASE+"/piner/house",{data:{test:"no-write"}});ok(write.status()===405,"POST must deny");
  const urls=["piner_journey_background.png","piner_mytime_background.png","piner_mobile_shell_background.png","piner_app_logo_no_yellow_transparent.png"];
  for(const f of urls){const r=await page.request.get(BASE+"/"+f);ok(r.status()===200,"R2 asset "+f);ok((r.headers()["content-type"]||"").includes("image/png"),"PNG "+f);}
  // The one explicit POST above is the negative-control test, never an application write.
  ok(report.writes.length===0,"unexpected app request writes "+JSON.stringify(report.writes));
  ok(report.errors.length===0,"browser errors "+JSON.stringify(report.errors));
  console.log("PAP1943_PREVIEW_G3_PASS "+JSON.stringify({viewportCases:report.cases.length,assets:urls.length,denials:paths.length,screenshots:report.screenshots.length,errors:report.errors.length,writes:report.writes.length}));
 }catch(err){report.errors.push(err.stack||String(err));console.error("PAP1943_PREVIEW_G3_FAIL "+(err.stack||err));process.exitCode=1}
 finally{fs.writeFileSync(path.join(evidence,"receipt-preview.json"),JSON.stringify(report,null,2));await context.close();await browser.close();console.log("PAP1943_HEADLESS_BROWSER_CLOSED");}
})().catch(err=>{console.error(err.stack);process.exitCode=1});
