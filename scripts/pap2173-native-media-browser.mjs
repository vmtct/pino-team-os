// PAP-2134 local synthetic native panel browser regression; no live environment.
import {build} from "esbuild";
import {chromium} from "playwright";
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const out=resolve(process.argv[2]??".next/pap2173-native-media-evidence"),bundle=resolve(out,"fixture.js");
await mkdir(out,{recursive:true});
await build({entryPoints:["scripts/fixtures/pap2173-native-media-entry.tsx"],outfile:bundle,bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"synthetic-next",setup(b){b.onResolve({filter:/^next\/(link|navigation|image|dynamic)$/},args=>({path:args.path,namespace:"synthetic"}));b.onLoad({filter:/.*/,namespace:"synthetic"},({path})=>({loader:"jsx",resolveDir:process.cwd(),contents:path==="next/image"?"import React from 'react';export default function Image(p){return <img {...p}/>}":path==="next/dynamic"?"export default function dynamic(){return function Unused(){return null}}":"import React from 'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export default function Link(p){return <a {...p}/>}"}));}}]});
const result={scope:"isolated synthetic native TDD + Media panel only; no G4",checks:[],browserClosed:false,serverClosed:false};
let browser,diagnosticPage;const pageErrors=[];
const server=createServer(async(req,res)=>{
 try{
  const port=server.address().port;
  if(req.socket.remoteAddress!=="127.0.0.1"||req.headers.host!=="127.0.0.1:"+port||req.method!=="GET"){res.writeHead(403);res.end();return;}
  const path=new URL(req.url,"http://127.0.0.1").pathname;
  res.setHeader("cache-control","no-store");
  if(path==="/bo/piner-posts"){res.setHeader("content-type","text/html");res.end('<!doctype html><html lang="vi" data-bo-ui-authority="v25"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');return;}
  if(path==="/fixture.js"||path==="/fixture.css"){res.setHeader("content-type",path.endsWith(".js")?"text/javascript":"text/css");res.end(await readFile(resolve(out,path.slice(1))));return;}
  res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end();}
});
try{
 await new Promise((ok,fail)=>{server.once("error",fail);server.listen({host:"127.0.0.1",port:0,exclusive:true},ok);});
 const origin="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2QAAAAASUVORK5CYII=","base64");
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  diagnosticPage=page;page.on("pageerror",e=>{errors.push(e.message);pageErrors.push(e.message);});await page.route("**/*",r=>{const u=new URL(r.request().url());return u.origin===origin||u.protocol==="blob:"?r.continue():r.abort();});
  await page.goto(origin+"/bo/piner-posts",{waitUntil:"domcontentloaded"});
  const input=page.locator('input[type=file]');await input.waitFor({timeout:15000});await input.setInputFiles({name:"qa.png",mimeType:"image/png",buffer:png});
  const retry=page.getByRole("button",{name:"Thử lại thao tác",exact:true});await retry.waitFor();await retry.click();
  await page.getByText("Media của Post (1/5)",{exact:true}).waitFor();
  const receipt=()=>page.getByTestId("receipt").textContent().then(JSON.parse);
  assert.deepEqual(await receipt(),{version:3,count:1,reserveCalls:1,confirmCalls:2});
  await page.getByRole("button",{name:"Xem ảnh",exact:true}).click();await page.getByRole("img",{name:"Ảnh 1",exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.images].some(i=>i.alt==="Ảnh 1"&&i.complete&&i.naturalWidth>0));
  await page.screenshot({path:resolve(out,width+"-preview.png"),fullPage:true});
  await page.getByRole("tab",{name:"Tổng quan",exact:true}).click();assert.equal(await page.getByRole("img",{name:"Ảnh 1",exact:true}).count(),0);
  await page.getByRole("tab",{name:"Media",exact:true}).click();await page.getByText("Media của Post (1/5)",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Gỡ Ảnh 1",exact:true}).click();await page.getByText("Media của Post (0/5)",{exact:true}).waitFor();
  assert.deepEqual(await receipt(),{version:4,count:0,reserveCalls:1,confirmCalls:2});assert.equal(errors.length,0,errors.join(";"));await page.close();
  const ro=await browser.newPage({viewport:{width,height:900}});await ro.route("**/*",r=>{const u=new URL(r.request().url());return u.origin===origin||u.protocol==="blob:"?r.continue():r.abort();});
  await ro.goto(origin+"/bo/piner-posts?readonly",{waitUntil:"domcontentloaded"});await ro.getByText("Media của Post (0/5)",{exact:true}).waitFor();assert.equal(await ro.locator('input[type=file]').count(),0);await ro.close();
  result.checks.push({width,uploadRetry:true,preview:true,tabUnmount:true,remove:true,readonly:true});
 }
 result.pass=true;
}catch(e){result.pass=false;result.error=String(e);result.pageErrors=pageErrors;if(diagnosticPage&&!diagnosticPage.isClosed()){result.syntheticText=(await diagnosticPage.locator("body").innerText()).slice(0,2000);await diagnosticPage.screenshot({path:resolve(out,"failure.png"),fullPage:true});}process.exitCode=1;}
finally{if(browser){await browser.close();result.browserClosed=true;}if(server.listening){await new Promise(ok=>server.close(ok));result.serverClosed=true;}await writeFile(resolve(out,"result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
