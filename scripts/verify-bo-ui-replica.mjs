// Optional local UI-only diagnostic. Does not use credentials, APIs or shared environments.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('public/bo-ui-replica');
const server=createServer(async(req,res)=>{
 try{
  const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+sep))throw new Error('outside fixture');
  const content=await readFile(file);
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const receipts=[];
try{
 for(const width of [390,768,1440])for(const key of ['students','classes']){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(8000);console.error('Checking',key,width);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/')||!r.url().startsWith(origin+'/'))requests.push(r.url());});
  await page.goto(`${origin}/index.html?module=${key}`);
  await page.waitForURL(`**/playground.html?module=${key}`);
  assert.equal(await page.evaluate(()=>window.PinoBOSharedWorkspace.moduleKey),key);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#table-body [data-record]').count(),key==='students'?8:5);
  const record=page.locator('#table-body [data-record]').first();
  const id=await record.getAttribute('data-record');
  // Typed edits are local mock changes; cancel must preserve the previous value.
  const numeric=key==='students'?'sessions':'capacity';
  const previous=await record.locator(`[data-edit="${numeric}"]`).innerText();
  await record.locator(`[data-edit="${numeric}"]`).click();
  await page.locator('#editor-value').fill('19');await page.locator('#edit-save').click();
  assert.equal(await page.locator(`[data-record="${id}"] [data-edit="${numeric}"]`).innerText(),'19');
  await page.locator(`[data-record="${id}"] [data-edit="${numeric}"]`).click();
  await page.locator('#editor-value').fill('20');await page.locator('#edit-cancel').click();
  assert.equal(await page.locator(`[data-record="${id}"] [data-edit="${numeric}"]`).innerText(),'19');
  await record.locator('.row-open').click();
  assert.equal(await page.locator('#drawer').getAttribute('aria-hidden'),'false');
  assert.equal(await page.locator('.quick-id').innerText(),id);
  await page.locator('#full-detail').click();
  assert.equal(await page.locator('#detail-screen').isVisible(),true);
  assert.equal(await page.locator('#detail-tabs [data-tab]').count(),3);
  await page.locator('#detail-tabs [data-tab="Hoạt động"]').click();
  assert.equal(await page.locator('#detail-tabs .selected').innerText(),'Hoạt động');
  await page.locator('#back-to-list').click();
  await page.locator('#settings-btn').click();
  await page.locator('[data-settings="filters"]').click();
  await page.locator('#add-rule').click();
  assert.equal(await page.locator('.rule-row').count(),1);
  await page.locator('#settings-close').click();
  await page.locator('#add-view-tab').click();
  await page.locator('.view-rename-input').fill('Pilot local');await page.locator('.view-rename-input').press('Enter');
  assert.match(await page.locator('.saved-tab').innerText(),/Pilot local$/);
  // No business writes or cross-module shared state survive reload.
  await page.reload();
  assert.equal(await page.locator(`[data-record="${id}"] [data-edit="${numeric}"]`).innerText(),previous);
  assert.equal(await page.locator('.saved-tab').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  receipts.push({key,width,result:'PASS',network:'LOCAL_STATIC_ONLY'});await context.close();
 }
 const page=await browser.newPage();await page.goto(origin+'/index.html?module=staff');
 assert.match(page.url(),/index.html\?module=staff$/);assert.equal(await page.evaluate(()=>typeof window.PinoBOSharedWorkspace),'undefined');
 console.log(JSON.stringify({result:'UI_ONLY_LOCAL_PASS_NOT_FOUNDER_APPROVAL',receipts,otherModules:'UNCHANGED_ENTRY'},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
