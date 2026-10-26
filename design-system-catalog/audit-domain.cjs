const {chromium}=require("playwright");
const fs=require("fs");
(async()=>{const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox"]});
const all=[];for(const width of [390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const errors=[],failed=[];page.on("pageerror",e=>errors.push(e.message));page.on("requestfailed",r=>failed.push(r.url()+" "+r.failure()?.errorText));
 await page.goto("https://ds.staging.pinohouse.art/?module=students",{waitUntil:"networkidle",timeout:20000});
 const rowCount=await page.locator(".grid-card tbody tr").count(),header=await page.locator(".page-heading h1").allTextContents();
 const src=await page.locator("#app").getAttribute("data-bo-runtime");
 const first=page.locator(".row-open").first();if(await first.isVisible())await first.click();
 const drawer=await page.locator("#drawer").isVisible().catch(()=>false);
 const fields=await page.locator(".property-row").count();
 const drawerRect=drawer?await page.locator("#drawer").boundingBox():null;
 const screenshotPath=__dirname+"/dist/audit-live-"+width+".png";await page.screenshot({path:screenshotPath,fullPage:true});
 if(drawer){const next=page.locator("#drawer button").filter({hasText:/Chi tiết|Detail|Mở/}).last();if(await next.count())await next.click();else{const detailButton=page.locator("#drawer").locator('button').last();await detailButton.click();}}
 const detail=await page.locator("#detail-screen").isVisible().catch(()=>false);
 all.push({width,rowCount,header,src,drawer,fields,drawerRect,detail,errors,failed,screenshotPath});await page.close();
}await browser.close();fs.writeFileSync(__dirname+"/dist/audit-live.json",JSON.stringify(all,null,2));console.log(JSON.stringify(all,null,2));})().catch(e=>{console.error(e);process.exit(1)});
