/** PAP-2192: local synthetic controller regression, no live transport. */
import {chromium} from "@playwright/test";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const root=resolve(".next/pap2192-review");
const assets={"/":"index.html","/fixture.js":"fixture.js","/fixture.css":"fixture.css"};
const server=createServer(async(req,res)=>{
 const name=assets[req.url];
 if(!name||!["GET","HEAD"].includes(req.method)){res.writeHead(403).end();return;}
 try{
  const body=await readFile(resolve(root,name));
  res.setHeader("content-type",name.endsWith(".html")?"text/html":name.endsWith(".js")?"application/javascript":"text/css");
  res.end(req.method==="HEAD"?undefined:body);
 }catch{res.writeHead(404).end();}
});
let browser;
try{
 await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
 const url="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({channel:"chrome",headless:true});
 const page=await browser.newPage();
 const errors=[],blocked=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",route=>{
  const request=route.request();
  if(new URL(request.url()).origin===url&&["GET","HEAD"].includes(request.method()))return route.continue();
  blocked.push(request.url());return route.abort();
 });
 const click=async name=>page.getByRole("button",{name,exact:true}).click();
 const value=async name=>page.locator('[data-test="'+name+'"]').textContent();
 const wait=async(name,expected)=>page.waitForFunction(([name,expected])=>document.querySelector('[data-test="'+name+'"]')?.textContent===expected,[name,expected]);
 await page.goto(url+"/#controller-regression");
 await click("Open test");await wait("open","true");
 await click("Fill test");await click("Retain test");await click("Close test");await wait("open","false");
 await click("Run retained");await wait("result","invalid");assert.equal(await value("calls"),"0");
 console.log("PASS: retained Save after close never submits");
 await click("Open test");await wait("open","true");
 await click("Fill test");await click("Run retained");assert.equal(await value("calls"),"0");
 console.log("PASS: previous drawer generation never submits into reopened drawer");
 await click("Retain test");await click("Run retained");await wait("result","unverified");await wait("uncertain","true");
 assert.equal(await value("calls"),"1");assert.equal(await value("open"),"false");
 await click("Run retained open");await click("Run retained");
 assert.equal(await value("calls"),"1");assert.equal(await value("open"),"false");assert.equal(await value("result"),"unverified");
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 console.log("PASS: uncertain result blocks retained Save and Open; one synthetic invocation only");
 await page.close();
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
