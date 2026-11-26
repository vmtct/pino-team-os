// PAP-2386 local synthetic native workflow browser regression; no live environment.
import {build} from "esbuild";
import {chromium} from "playwright";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const out=resolve(process.argv[2]??".next/pap2386-native-workflow-evidence"),bundle=resolve(out,"fixture.js");
await mkdir(out,{recursive:true});
await build({entryPoints:["scripts/fixtures/pap2386-native-workflow-entry.tsx"],outfile:bundle,bundle:true,format:"esm",jsx:"automatic",loader:{".png":"dataurl",".svg":"dataurl",".woff2":"dataurl",".woff":"dataurl",".jpg":"dataurl"},plugins:[{name:"synthetic-next",setup(b){b.onResolve({filter:/^next\/(link|navigation|image|dynamic)$/},args=>({path:args.path,namespace:"synthetic"}));b.onLoad({filter:/.*/,namespace:"synthetic"},({path})=>({loader:"jsx",resolveDir:process.cwd(),contents:path==="next/image"?"import React from 'react';export default function Image(p){return <img {...p}/>}":path==="next/dynamic"?"export default function dynamic(){return function Unused(){return null}}":"import React from 'react';export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export default function Link(p){return <a {...p}/>}"}));}}]});
const result={scope:"isolated synthetic actual native session/TDD + Media workflow; no G4",checks:[],browserClosed:false,serverClosed:false};
let browser,diagnosticPage;const pageErrors=[];
const origin="https://bo.staging.pinohouse.art";
async function isolatedPage(browser,width){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:"block"});
 await context.route("**/*",async r=>{
  const u=new URL(r.request().url());
  if(u.origin!==origin||r.request().method()!=="GET")return r.abort();
  if(u.pathname==="/bo/piner-posts")return r.fulfill({status:200,contentType:"text/html",body:'<!doctype html><html lang="vi" data-bo-ui-authority="v25"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>'});
  if(u.pathname==="/fixture.js"||u.pathname==="/fixture.css")return r.fulfill({status:200,contentType:u.pathname.endsWith(".js")?"text/javascript":"text/css",body:await readFile(resolve(out,u.pathname.slice(1)))});
  return r.abort();
 });
 return context.newPage();
}
try{
 browser=await chromium.launch({headless:true});
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAGAAAABICAIAAACGBWc0AAAAhElEQVR4nO3QQQ0AIBDAsBOGErQjBgd82aPJBCyds5cezfeDeIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQp3Afy7CEqsSDUTAAAAAElFTkSuQmCC","base64");
 for(const width of [390,1440]){
  const page=await isolatedPage(browser,width),errors=[];diagnosticPage=page;page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin+"/bo/piner-posts",{waitUntil:"domcontentloaded"});
  const diary=page.getByRole("region",{name:"Diary nguồn",exact:true});await diary.waitFor({timeout:20000});
  const checks=diary.getByRole("checkbox");await checks.nth(0).waitFor();assert(await checks.nth(1).isDisabled());
  await checks.nth(0).click();await page.waitForFunction(()=>{const r=JSON.parse(document.querySelector('[data-testid=receipt]').textContent);return r.version===2&&r.selectionCalls===1;});await diary.getByText("Đã chọn",{exact:true}).waitFor();assert(await checks.nth(0).isChecked());
  await diary.getByRole("button",{name:"Xem ảnh gốc"}).first().click();await diary.getByRole("button",{name:"Ảnh 1",exact:true}).click();
  await diary.getByRole("img",{name:"Ảnh gốc Diary đã xác minh"}).waitFor();
  await diary.getByRole("button",{name:"Thêm ảnh gốc",exact:true}).click();
  const retry=diary.getByRole("button",{name:"Tiếp tục đúng yêu cầu ảnh Diary",exact:true});await retry.waitFor();await retry.click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=receipt]').textContent).version===5);
  const receipt=()=>page.getByTestId("receipt").textContent().then(JSON.parse);
  let r=await receipt();assert.equal(r.reserveCalls,1);assert.equal(r.confirmCalls,2);assert.equal(r.linkCalls,1);assert.equal(r.provenance[0].transform,"RAW");
  await diary.getByRole("button",{name:"Xem ảnh gốc"}).first().click();await diary.getByRole("button",{name:"Ảnh 1",exact:true}).click();
  const paste=diary.getByRole("textbox",{name:"Dán ảnh đã chỉnh sửa"});await paste.waitFor();await paste.evaluate((e,base64)=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],"retouched.png",{type:"image/png"}));e.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));},png.toString("base64"));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=receipt]').textContent).version===8);
  r=await receipt();assert.equal(r.reserveCalls,2);assert.equal(r.confirmCalls,3);assert.equal(r.linkCalls,2);assert.equal(r.provenance[1].transform,"RETOUCHED");
  const review=page.getByRole("region",{name:"Xem trước bài đăng"});await review.getByRole("img",{name:"Ảnh xem trước bài đăng"}).waitFor();await review.getByRole("button",{name:"Chuyển ảnh 2 lên"}).click();
  await review.getByRole("button",{name:"Gửi duyệt",exact:true}).click();await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=receipt]').textContent).version===9);
  r=await receipt();assert.equal(r.submitCalls,1);assert.deepEqual(r.order,[r.provenance[1].attachmentId,r.provenance[0].attachmentId]);await review.getByText("Bài đăng đang chờ HO duyệt.",{exact:true}).waitFor();
  assert.equal(await review.getByRole("button",{name:"Gửi duyệt",exact:true}).count(),0);assert(await diary.getByRole("checkbox").first().isDisabled());await review.getByRole("button",{name:"Xem ảnh 1",exact:true}).click();await page.waitForFunction(()=>{const i=document.querySelector('img[alt="Ảnh xem trước bài đăng"]');return i&&i.complete&&i.naturalWidth===96&&i.naturalHeight===72;});const geometry=await review.evaluate(async e=>{const hero=e.querySelector('.pap2337-bo-hero'),im=hero.querySelector('img'),thumbs=[...e.querySelectorAll('.pap2337-bo-filmThumb img')];const bitmap=await createImageBitmap(await(await fetch(im.src)).blob());const canvas=new OffscreenCanvas(1,1),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3);bitmap.close();return {width:hero.getBoundingClientRect().width,viewport:innerWidth,scroll:document.documentElement.scrollWidth,thumbs:thumbs.filter(i=>i.complete&&i.naturalWidth===96).length,rgb};});assert(geometry.width<=420&&geometry.scroll<=geometry.viewport+1&&geometry.thumbs===2,JSON.stringify(geometry));assert.deepEqual(geometry.rgb,[220,90,60]);assert.equal(errors.length,0,errors.join(";"));await page.screenshot({path:resolve(out,width+"-pending.png"),fullPage:true});await page.context().close();
  const m=await isolatedPage(browser,width);await m.goto(origin+"/bo/piner-posts?mytime",{waitUntil:"domcontentloaded"});await m.getByRole("region",{name:"Xem trước bài đăng"}).waitFor();assert.equal(await m.getByRole("region",{name:"Diary nguồn"}).count(),0);await m.context().close();
  result.checks.push({width,selection:true,lostConfirmRecovery:true,raw:true,paste:true,order:true,immutablePending:true,mytimeNoDiary:true});
 }
 result.pass=true;
}catch(e){result.pass=false;result.error=String(e);result.pageErrors=pageErrors;if(diagnosticPage&&!diagnosticPage.isClosed()){result.syntheticText=(await diagnosticPage.locator("body").innerText()).slice(0,2000);await diagnosticPage.screenshot({path:resolve(out,"failure.png"),fullPage:true});}process.exitCode=1;}
finally{if(browser){await browser.close();result.browserClosed=true;}result.networkMode="offline route fulfill only";await writeFile(resolve(out,"result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
