/** PAP-2181 local-only, owned server and disposable browser. */
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const http=require("node:http");
let browser;
const server=spawn(process.execPath,["scripts/serve-enrollment-shell-review.mjs","--smoke"],{stdio:["ignore","pipe","inherit"]});
const base=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error("Server start timeout")),20000);server.stdout.on("data",data=>{const match=String(data).match(/PAP2181_REVIEW_READY (http:\/\/127\.0\.0\.1:\d+\/bo\/enrollments)/);if(match){clearTimeout(t);resolve(match[1]);}});server.on("exit",code=>{clearTimeout(t);reject(Error("Server exit "+code));});});
const check=(url,method,host)=>new Promise((resolve,reject)=>{const req=http.request(url,{method,headers:host?{Host:host}:{}},res=>{res.resume();resolve(res.statusCode);});req.on("error",reject);req.end();});
(async()=>{const url=await base;assert.equal(await check(url,"GET"),200);assert.equal(await check(url,"HEAD"),200);assert.equal(await check(url,"POST"),403);assert.equal(await check(url,"GET","wrong.invalid"),403);assert.equal(await check(new URL("/api/bo/school/enrollments",url),"GET"),403);
browser=await chromium.launch({channel:"chrome",headless:true});
for(const width of [1440,768,390]){const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(url);await page.getByText("Nguyễn Minh An",{exact:true}).first().waitFor();assert.equal(await page.getByText("Nguyễn Minh An",{exact:true}).count(),2);
await page.getByText("Nguyễn Minh An",{exact:true}).first().click();await page.locator("#full-detail").waitFor();await page.locator("#full-detail").click();await page.locator('[data-tdd-shell="detail"]').waitFor();assert.equal(errors.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log("PAP2181_WIDTH_PASS",width);await page.close();}
const p=await browser.newPage();await p.goto(url+"?centerId=019d2181-0000-7000-8000-000000000200");await p.getByText("Lê Hoàng Nam",{exact:true}).waitFor();assert.equal(await p.getByText("Nguyễn Minh An",{exact:true}).count(),0);await p.close();console.log("PAP2181_SMOKE_PASS");})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();});
