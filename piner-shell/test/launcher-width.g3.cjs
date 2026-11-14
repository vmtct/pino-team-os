"use strict";
// PAP-1962 · PNR-APP-HUB · launcher rendered pixel-width parity, executable on i5.
const { chromium } = require(process.env.PINER_PLAYWRIGHT_CORE || "playwright-core");
const BASE = process.env.PINER_SHELL_BASE || "https://app.staging.pinohouse.art";
const EXPECT_EQUAL = process.env.PAP1962_ASSERT === "1";
const USE_LOCAL = process.env.PAP1962_LOCAL === "1";
const WIDTHS = [320, 390, 430, 768, 1024, 1440, 1920];
(async () => {
 const browser = await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--disable-extensions"]});
 const context = await browser.newContext();
 const page = await context.newPage();
 if(USE_LOCAL) {
  const path = require("node:path");
  const {pathToFileURL} = require("node:url");
  const root=path.resolve(__dirname,"../src");
  const [{renderHtml},{parseRoute,getShellAdapter},{CSS}] = await Promise.all([
   import(pathToFileURL(path.join(root,"view.mjs")).href),
   import(pathToFileURL(path.join(root,"adapter.mjs")).href),
   import(pathToFileURL(path.join(root,"styles.mjs")).href)
  ]);
  const html=renderHtml(parseRoute("/"),getShellAdapter());
  await page.route("**/*",async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==="/")return route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
   if(p==="/piner-shell.css")return route.fulfill({status:200,contentType:"text/css; charset=utf-8",body:CSS});
   return route.continue();
  });
 }
 let pass = 0;
 try {
  for (const width of WIDTHS) {
   await page.setViewportSize({width,height:850});
   const r = await page.goto(BASE + "/",{waitUntil:"networkidle",timeout:30000});
   if(r.status()!==200)throw Error("HTTP "+r.status()+" at "+width);
   const m=await page.evaluate(()=>{
    const el=document.querySelector(".program-card.house .card-copy strong");
    if(!el)throw Error("Missing Afterschool title");
    const first=el.querySelector(".pino-word") || [...el.childNodes].find(x=>x.nodeType===Node.TEXT_NODE && x.textContent.trim()==="PINO");
    const second=el.querySelector(".afterschool-word") || [...el.childNodes].find(x=>x.nodeType===Node.TEXT_NODE && x.textContent.trim()==="Afterschool");
    if(!first||!second)throw Error("Words not individually measurable");
    const widthOf=n=>{const range=document.createRange();range.selectNodeContents(n);return range.getBoundingClientRect().width};
    const pino=widthOf(first),after=widthOf(second);
    const card=el.closest(".program-card").getBoundingClientRect();
    const tag=el.closest(".program-card").querySelector(".tagline").getBoundingClientRect();
    const style1=getComputedStyle(first.nodeType===Node.ELEMENT_NODE?first:el);
    const style2=getComputedStyle(second.nodeType===Node.ELEMENT_NODE?second:el);
    return {pino,afterschool:after,diff:after-pino,ratio:after/pino,fontPino:style1.fontSize,fontAfter:style2.fontSize,
     overflow:document.documentElement.scrollWidth>innerWidth+1,cardRight:card.right,tagRight:tag.right};
   });
   console.log("PAP1962_WIDTH "+width+" "+JSON.stringify(m));
   if(width===390){const fs=require("node:fs"),path=require("node:path");const dir=path.join(__dirname,"../evidence");fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,"pap1962-launcher-"+(USE_LOCAL?"local":"staging")+"-390.png")});}
   if(EXPECT_EQUAL){
    if(m.overflow||Math.abs(m.diff)>2||m.tagRight>m.cardRight+1)
     throw Error("PAP1962_PARITY_FAIL width "+width+" diff "+m.diff+" overflow "+m.overflow);
    pass++;
   }
  }
  console.log(EXPECT_EQUAL?"PAP1962_RENDERED_PIXEL_PARITY_PASS "+pass+"/"+WIDTHS.length:"PAP1962_BASELINE_MEASURED "+WIDTHS.length);
 }finally{await context.close();await browser.close();console.log("PAP1962_CHROME_CLOSED");}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
