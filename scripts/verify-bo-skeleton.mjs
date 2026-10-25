// PAP-979 targeted Windows/Linux local visual fixtures. No shared API access.
import {chromium} from '@playwright/test';
import {injectStudentsBridge} from '../lib/bo-skeleton.ts';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const runtime=resolve('public/bo-authority-source'),authority=resolve(process.env.PAP979_AUTHORITY||runtime);
const output=resolve(process.env.PAP979_SKELETON_EVIDENCE||'.pap979-evidence/skeleton');await mkdir(output,{recursive:true});
const bridge=await readFile(runtime+'/skeleton-bridge.js','utf8'),manifest=JSON.parse(await readFile(runtime+'/manifest.json','utf8'));
for(const [file,sha] of Object.entries(manifest.files)){
 const actual=await readFile(runtime+'/'+file),expected=await readFile(authority+'/'+file);
 assert.ok(actual.equals(expected),'Authority bytes differ: '+file);assert.equal(createHash('sha256').update(actual).digest('hex'),sha);
}
const fixtures=Array.from({length:103},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),displayName:'Học viên '+String(i+1).padStart(3,'0'),status:'ACTIVE',birthYear:2017,activePaths:[{displayName:'Artchitect'}],houseMember:i%2===0}));
let responseStatus=200;const apiRequests=[],pageErrors=[];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/bo/learners'){
   apiRequests.push({method:req.method,path:url.pathname,query:url.search});assert.equal(req.method,'GET');
   res.writeHead(responseStatus,{'content-type':'application/json'});return res.end(JSON.stringify(responseStatus===200?{data:url.searchParams.has('beforeStudentId')?fixtures.slice(100):fixtures.slice(0,100)}:{error:{message:'fixture denial'}}));
  }
  const expected=url.pathname.startsWith('/authority/'),base=expected?authority:runtime;
  const name=url.pathname.split('/').at(-1),file=resolve(base,name);
  if(!file.startsWith(base+sep))throw Error('outside fixture');
  let body=await readFile(file);if(!expected&&name==='playground.js')body=Buffer.from(injectStudentsBridge(body.toString(),bridge));
  res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'application/octet-stream'});res.end(body);
 }catch(error){res.writeHead(404);res.end(String(error));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true}),results=[];
async function shot(p,name,selector){await p.mouse.move(0,0);await p.evaluate(()=>document.fonts.ready);return p.locator(selector).screenshot({path:output+'/'+name+'.png',animations:'disabled'});}
async function open(p){await p.locator('#table-body .row-open').first().click();await p.locator('#drawer.open').waitFor();}
async function detail(p){await p.locator('#full-detail').click();await p.locator('#detail-screen:not(.hidden)').waitFor();}
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(12000);
  p.on('pageerror',e=>pageErrors.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const shots={};
  for(const [kind,prefix] of [['runtime',''],['authority','/authority']]){
   await p.goto(origin+prefix+'/playground.html');await p.locator('#table-body .row-open').first().waitFor();
   await p.screenshot({path:output+'/'+kind+'-'+width+'-shell.png',fullPage:true,animations:'disabled'});
   shots[kind]={table:await shot(p,kind+'-'+width+'-table','#workspace')};
   await open(p);shots[kind].drawer=await shot(p,kind+'-'+width+'-drawer','#drawer');await detail(p);
   for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){await p.locator('[data-tab="'+tab+'"]').click();shots[kind][tab]=await shot(p,kind+'-'+width+'-'+['Detail','Chuyên Sâu','Lịch Sử'].indexOf(tab),'#detail-screen');}
   await p.locator('#back-to-list').click();await p.locator('#settings-btn').click();shots[kind].settings=await shot(p,kind+'-'+width+'-settings','#settings-panel');
  }
  for(const name of Object.keys(shots.runtime)){assert.ok(shots.runtime[name].equals(shots.authority[name]),`${width} ${name} differs from registration authority`);results.push({width,component:name,pixelEqual:true});}
  const start=apiRequests.length;
  await p.goto(origin+'/playground.html?module=students');await p.locator('#table-body [data-record]').first().waitFor();
  assert.equal(apiRequests.length-start,2,'canonical directory pagination');assert.match(apiRequests.at(-1).query,/beforeStudentId=/);
  assert.equal(await p.locator('#table-count').textContent(),'103 bản ghi');assert.equal(await p.locator('#add-record').isDisabled(),true);
  await shot(p,'students-'+width+'-table','#workspace');
  await p.screenshot({path:output+'/students-'+width+'-shell.png',fullPage:true,animations:'disabled'});
  await p.locator('#settings-btn').click();await p.locator('[data-settings="filters"]').click();await p.locator('#add-rule').click();await p.locator('#rule-rows .rule-row').waitFor();
  await p.locator('#clear-rules').click();await p.locator('#settings-close').click();
  await open(p);await shot(p,'students-'+width+'-drawer','#drawer');await detail(p);
  assert.equal(await p.locator('.v24-prop-item').count(),6);
  for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){await p.locator('[data-tab="'+tab+'"]').click();await shot(p,'students-'+width+'-'+['Detail','Chuyên Sâu','Lịch Sử'].indexOf(tab),'#detail-screen');}
  assert.equal(await p.locator('.v25-audit-row').count(),0);assert.match(await p.locator('#detail-body').textContent(),/chưa kết nối/);
  assert.equal(apiRequests.length-start,2,'drawer/detail/history/settings have no API wiring');
  await p.goto(origin+'/playground.html?module=classes');await shot(p,'classes-'+width+'-table','#workspace');await open(p);await shot(p,'classes-'+width+'-drawer','#drawer');await detail(p);assert.equal(apiRequests.length-start,2);
  for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){await p.locator('[data-tab="'+tab+'"]').click();await shot(p,'classes-'+width+'-'+['Detail','Chuyên Sâu','Lịch Sử'].indexOf(tab),'#detail-screen');}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.close();
 }
 for(const status of [403,409]){
  responseStatus=status;const p=await browser.newPage();await p.goto(origin+'/playground.html?module=students');await p.locator('#table-body [role="alert"]').waitFor();assert.equal(await p.locator('#table-body [data-record]').count(),0);await p.close();
 }
 assert.deepEqual(pageErrors,[]);assert.ok(apiRequests.every(r=>r.method==='GET'&&r.path==='/api/bo/learners'));
 await writeFile(output+'/receipt.json',JSON.stringify({result:'LOCAL_VISUAL_PASS',baseline:'Hồ sơ đăng ký only',sourceHashes:manifest.files,pixelComparisons:results,contract:'GET_ONLY_STUDENTS_PAGINATION_DENIAL_PASS',apiRequests},null,2));
 console.log(JSON.stringify({result:'LOCAL_VISUAL_PASS',pixelComparisons:results.length,contract:'PASS',evidence:output}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
