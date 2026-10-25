// Targeted Windows React component diagnostic. No backend authentication is bypassed.
import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output='.pap993-evidence/local'; await mkdir(output,{recursive:true});
const compiled=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {HoCenters} from './app/ho/centers/HoCenters';import {BoRegistrationWorkspace} from './app/bo/components/registration/BoRegistrationWorkspace';createRoot(document.getElementById('root')).render(location.pathname==='/bo'?<BoRegistrationWorkspace currentUser={{displayName:null}}/>:<HoCenters/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const rows=JSON.parse(await readFile('.pap993-evidence/centers-audit.json','utf8'));
let mode='ready';const requests=[],errors=[];
const css=['styles.css','playground.css','playground-v22.css','playground-v23.css','full-detail-v24.css','full-detail-v25.css'];
const server=createServer(async(req,res)=>{try {
 const u=new URL(req.url,'http://local');
 if(u.pathname==='/api/bo/centers'){requests.push({method:req.method,path:u.pathname});res.writeHead(mode==='error'?503:200,{'content-type':'application/json'});return res.end(JSON.stringify(mode==='error'?{error:{message:'Dịch vụ chưa khả dụng.'}}:{data:mode==='empty'?[]:mode==='invalid'?[{}]:rows}));}
 if(u.pathname.startsWith('/api/')){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({data:[]}));}
 if(u.pathname==='/ho'||u.pathname==='/bo'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="vi" '+(u.pathname==='/ho'?'data-surface="ho"':'')+'><head><meta name="viewport" content="width=device-width,initial-scale=1">'+css.map(n=>'<link rel="stylesheet" href="/'+n+'">').join('')+(u.pathname==='/ho'?'<link rel="stylesheet" href="/ho-theme.css">':'')+'</head><body><div id="root"></div><script src="/runtime.js"></script></body></html>');}
 if(u.pathname==='/runtime.js'){res.setHeader('content-type','text/javascript');return res.end(compiled.outputFiles[0].contents);}
 if(u.pathname==='/ho-theme.css'){res.setHeader('content-type','text/css');return res.end(await readFile('app/ho/ho-theme.css'));}
 const name=u.pathname.slice(1);assert.ok(css.includes(name));res.setHeader('content-type','text/css');res.end(await readFile('public/bo-authority-source/'+name));
 }catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const checks=[];
try { for(const width of [390,768,1440]){
 mode='ready'; const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await page.goto(origin+'/ho');await expect(page.locator('#table-count')).toHaveText(rows.length+' bản ghi');await expect(page.locator('#add-record')).toHaveCount(0);assert.equal(await page.locator('.nav-link').count(),1);
 assert.equal(await page.locator('.nav-link.active').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(116, 40, 62)');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/ho-table-'+width+'.png',fullPage:true});
 await page.locator('#search').fill('can-tho');await expect(page.locator('#table-count')).toHaveText('1 bản ghi');await page.locator('.row-open').click();await expect(page.locator('#drawer-title')).toHaveText('Cần Thơ');await expect(page.locator('[data-prop="centerKey"]')).toContainText('can-tho');
 assert.equal(await page.locator('#full-detail').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(116, 40, 62)');await page.screenshot({path:output+'/ho-drawer-'+width+'.png',fullPage:true});
 await page.locator('#full-detail').click();await expect(page.locator('#detail-title')).toHaveText('Cần Thơ');await expect(page.locator('#detail-body')).toContainText(rows.find(r=>r.key==='can-tho').id);await page.screenshot({path:output+'/ho-detail-'+width+'.png',fullPage:true});
 await page.locator('#back-to-list').click();await expect(page.locator('#search')).toHaveValue('can-tho');await page.locator('#search').fill('no-matching-record');await expect(page.locator('.empty-table')).toContainText('Không có bản ghi');
 if(width===390){await page.locator('#menu-btn').click();await expect(page.locator('#sidebar')).toHaveClass(/show/);await page.locator('#nav-scrim').click({position:{x:width-8,y:500}});}
 mode='error';await page.reload();await expect(page.getByRole('button',{name:'Thử lại'})).toBeVisible();mode='ready';await page.getByRole('button',{name:'Thử lại'}).click();await expect(page.locator('#table-count')).toHaveText(rows.length+' bản ghi');
 mode='invalid';await page.reload();await expect(page.getByRole('alert')).toContainText('không hợp lệ');mode='empty';await page.reload();await expect(page.locator('.empty-table')).toContainText('Không có bản ghi');
 mode='ready';await page.goto(origin+'/bo');await expect(page.locator('.brand-type small')).toHaveText('Back Office');assert.equal(await page.locator('.primary-btn').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(107, 91, 214)');await page.screenshot({path:output+'/bo-comparison-'+width+'.png',fullPage:true});
 await page.close();checks.push({width,result:'PASS'});
 }assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'));await writeFile(output+'/receipt.json',JSON.stringify({kind:'LOCAL_COMPONENT_DIAGNOSTIC',checks,errors,requests,liveAcceptance:false},null,2));console.log(JSON.stringify({checks,errors}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
