// Focused Windows/Linux React component parity checks. Synthetic local transport only.
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import * as f from './fixtures/bo-react-api.mjs';
const runtime=resolve('public/bo-authority-source'),authority=resolve(process.env.PAP986_AUTHORITY||runtime),output=resolve(process.env.PAP986_EVIDENCE||'.pap986-evidence/local');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(runtime+'/manifest.json','utf8'));
for(const [file,sha] of Object.entries(manifest.files)){const bytes=await readFile(runtime+'/'+file);assert.ok(bytes.equals(await readFile(authority+'/'+file)));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);}
const compiled=await build({entryPoints:['scripts/fixtures/bo-react-entry.tsx'],bundle:true,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',write:false,define:{'process.env.NODE_ENV':'"production"'}}),bundle=compiled.outputFiles[0].contents;
const css=Object.keys(manifest.files).filter(n=>n.endsWith('.css'));
// Exact stylesheet order from authority HTML, not filesystem/manifest order.
const links=['styles.css','playground.css','playground-v22.css','playground-v23.css','full-detail-v24.css','full-detail-v25.css'];assert.equal(css.length,6);
let status=200,historyMode='valid';const requests=[],errors=[];
const server=createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/api/')){
    requests.push({method:req.method,path:u.pathname,query:u.search});assert.equal(req.method,'GET');let data,page;
    switch(u.pathname){
      case '/api/bo/learners': data=u.searchParams.has('beforeStudentId')?f.students.slice(100):f.students.slice(0,100);break;
      case '/api/bo/delivery/bootstrap-state':data={runningClasses:f.classes,terms:f.terms,termWeeks:f.termWeeks,paths:[{id:'00000000-0000-4000-8000-000000000900',displayName:'Artchitect'}],centers:[{id:'00000000-0000-4000-8000-000000000901',displayName:'Cơ sở test'}]};break;
      case '/api/bo/subscriptions':data={items:f.subscriptions,nextCursor:null};break;
      case '/api/bo/school/enrollments':data={items:f.enrollments,nextCursor:null};break;
      case '/api/bo/centers':data=[{id:'00000000-0000-4000-8000-000000000901',displayName:'Test'}];break;
      case '/api/bo/workforce/timekeeping/centers':data=[{id:'00000000-0000-4000-8000-000000000901',displayLabel:'Test'}];break;
      case '/api/bo/workforce/staff-records':data=f.staff;break;
      case '/api/bo/student-visits':data={data:f.visits,total:3};break;
      case '/api/bo/workforce/timekeeping':data={data:f.timekeeping,nextCursor:null};break;
      case '/api/bo/workforce/payroll/periods':data={data:f.periods,total:3,nextOffset:null};break;
      case '/api/bo/pinoria/worlds':data={worlds:f.worlds};break;
      case '/api/bo/pinoria/ward/catalog':data={items:f.items};break;
      case '/api/bo/pinoria/ward/sets':data={sets:f.sets};break;
      case '/api/bo/access/users':data=f.users;break;
      case '/api/bo/access/roles':data=f.roles;break;
      case '/api/bo/access/audit':data=f.audits;page={offset:0,limit:100,hasNext:false};break;
      case '/api/bo/audit/subject':{
        const subject_type=u.searchParams.get('subject_type'),subject_id=u.searchParams.get('subject_id'),second=u.searchParams.has('cursor');
        assert.ok(['student_profile','running_class'].includes(subject_type));
        data={events:[{id:second?'event-1':'event-2',subject_type:historyMode==='cross-type'?'running_class':subject_type,subject_id:historyMode==='cross-subject'?'00000000-0000-4000-8000-999999999999':subject_id,occurred_at:second?'2026-10-24T01:00:00Z':'2026-10-25T01:00:00Z',actor_id:null,actor_label:'Nhân viên',action:(second?'Tạo ':'Cập nhật ')+(subject_type==='running_class'?'lớp học':'học viên'),outcome:'succeeded',field:null,before:null,after:null,description:null,redacted:historyMode!=='unredacted'}],nextCursor:second?null:'page-2'};break;
      }
      default:throw Error('unexpected API '+u.pathname);
    }
    res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(status===200?{data,...(page?{page}:{})}:{error:{code:'DENIED',message:'fixture denial'}}));return;
  }
  if(u.pathname==='/bo'||u.pathname==='/') {res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+links.map(n=>'<link rel="stylesheet" href="/bo-skeleton/'+n+'">').join('')+'</head><body><div id="root"></div><script src="/runtime.js"></script></body></html>');}
  if(u.pathname==='/runtime.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(bundle);}
  const name=u.pathname.split('/').at(-1),file=resolve(runtime,name);
  assert.ok(file.startsWith(runtime+sep));assert.ok(Object.hasOwn(manifest.files,name));
  res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'text/plain'});res.end(await readFile(file));
}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),checks=[],typed=[],source=[];
async function screenshot(p,name,selector){await p.mouse.move(-10,-10);await p.evaluate(()=>document.fonts.ready);await (selector?p.locator(selector):p).screenshot({path:output+'/'+name+'.png',animations:'disabled',...(!selector?{fullPage:true}:{})});}
async function noOverflow(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  // Capture the ACTUAL current prototype with its own script, separately labelled.
  await p.goto(origin+'/authority/playground.html');await p.locator('#table-body .row-open').first().waitFor();await screenshot(p,'authority-'+width+'-table');
  await p.locator('#table-body .row-open').first().click();await screenshot(p,'authority-'+width+'-drawer','#drawer');await p.locator('#full-detail').click();await screenshot(p,'authority-'+width+'-detail','#detail-screen');
  const baseline=await p.locator('.detail-hero').evaluate(e=>({padding:getComputedStyle(e).padding,font:getComputedStyle(e.querySelector('h1')).fontSize}));source.push({width,baseline});
  for(const [key,label,count,fields] of f.moduleChecks){
    await p.goto(origin+'/bo?module='+key);await p.locator('#table-body .row-open').first().waitFor();assert.equal(await p.locator('[data-bo-runtime="react"]').count(),1);assert.equal(await p.locator('#list-screen h1').textContent(),label);assert.equal(await p.locator('#table-count').textContent(),count+' bản ghi');assert.equal(await p.locator('#lab-nav a[href]').count(),15);assert.equal(await p.locator('.topbar,.topbar-breadcrumb').count(),0);await noOverflow(p);await screenshot(p,key+'-'+width+'-table');
    const scroll=await p.locator('#table-scroll').evaluate(e=>{e.scrollLeft=200;return e.scrollLeft;});
    await p.locator('#table-body .row-open').first().click();const trigger=await p.locator('#table-body [data-record]').first().getAttribute('data-record');await p.locator('#drawer.open').waitFor();assert.equal(await p.locator('#drawer .property-row').count(),fields);assert.equal(await p.locator('#drawer .drawer-record-title').count(),1);assert.equal(await p.locator('#drawer-footer button').count(),1);await screenshot(p,key+'-'+width+'-drawer','#drawer');
    await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('#full-detail').evaluate(e=>e===document.activeElement),true);await p.keyboard.press('Tab');assert.equal(await p.locator('#drawer-close').evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Escape');assert.equal(await p.locator('[data-open="'+trigger+'"]').evaluate(e=>e===document.activeElement),true);await p.locator('[data-open="'+trigger+'"]').click();await p.locator('#full-detail').click();assert.equal(await p.locator('.v24-prop-item').count(),fields);assert.equal(await p.locator('.detail-hero').evaluate(e=>getComputedStyle(e).padding),baseline.padding);assert.equal(await p.locator('.detail-hero h1').evaluate(e=>getComputedStyle(e).fontSize),baseline.font);
    for(const [i,tab] of ['Detail','Chuyên Sâu','Lịch Sử'].entries()){await p.locator('[data-tab="'+tab+'"]').click();if(i===2&&['students','classes'].includes(key))await p.locator('.v25-audit-row').first().waitFor();await noOverflow(p);await screenshot(p,key+'-'+width+'-'+i,'#detail-screen');}
    assert.doesNotMatch(await p.locator('#detail-screen').innerText(),/MOCK|FULL DETAIL|ENTITY SNAPSHOT|API CAPABILITIES|READ ONLY|SUCCESS|registration\./);
    if(['students','classes'].includes(key)){assert.equal(await p.locator('.v25-audit-row').count(),2);await p.locator('#v24-history-search').fill('cập nhật');assert.equal(await p.locator('.v25-audit-row').count(),1);await p.locator('#v24-history-search').fill('nhân viên');assert.equal(await p.locator('.v25-audit-row').count(),2);}
    await p.locator('#back-to-list').click();assert.equal(await p.locator('[data-open="'+trigger+'"]').evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('#table-scroll').evaluate(e=>e.scrollLeft),scroll);
    if(width===390){await p.locator('#menu-btn').click();assert.equal(await p.locator('#menu-btn').getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');assert.equal(await p.locator('#menu-btn').getAttribute('aria-expanded'),'false');}
    checks.push({key,width,table:true,drawer:true,threeTabs:true,focusRestore:true,noOverflow:true});
  }
  // Existing settings, filter/group/search/sort, local saved view, undo, create validation.
  await p.goto(origin+'/bo');await p.locator('#table-body .row-open').first().waitFor();await p.locator('#settings-btn').click();await p.locator('[data-settings="filters"]').click();await p.locator('#add-rule').click();await p.locator('.rule-value-input').fill('001');await p.locator('#settings-close').click();assert.equal(await p.locator('#table-body [data-record]').count(),1);await p.locator('#settings-btn').click();await p.locator('[data-settings="views"]').click();await p.locator('#view-name').fill('Review');await p.locator('#save-view-confirm').click();await p.locator('#settings-close').click();assert.equal(await p.locator('.saved-tab').count(),1);
  await p.locator('#settings-btn').click();await p.locator('[data-settings="properties"]').click();await p.locator('[data-eye="id"]').click();await p.locator('#settings-close').click();assert.equal(await p.locator('[data-sort="id"]').count(),0);await p.keyboard.press('Control+z');assert.equal(await p.locator('[data-sort="id"]').count(),1);
  await p.locator('.saved-tab').focus();await p.keyboard.press('F2');await p.locator('.view-rename-input').fill('Founder review');await p.keyboard.press('Enter');assert.match(await p.locator('.saved-tab').innerText(),/Founder review/);await p.locator('.saved-tab').click({button:'right'});await p.getByRole('menuitem',{name:'Xóa view'}).click();assert.equal(await p.locator('.saved-tab').count(),0);await p.keyboard.press('Control+z');assert.equal(await p.locator('.saved-tab').count(),1);
  await p.locator('#settings-btn').click();await screenshot(p,'settings-'+width+'-home','#settings-panel');await p.locator('[data-settings="group"]').click();await p.locator('#group-by').selectOption('status');await p.locator('#group-collapse-all').click();await p.locator('#settings-close').click();assert.equal(await p.locator('#table-body [data-record]').count(),0);await p.locator('#settings-btn').click();await p.locator('[data-settings="group"]').click();await p.locator('#group-expand-all').click();await screenshot(p,'settings-'+width+'-group','#settings-panel');await p.locator('#remove-group').click();await p.locator('#settings-close').click();assert.equal(await p.locator('#table-body [data-record]').count(),1);
  await p.locator('#add-record').click();assert.equal(await p.locator('[data-prop="id"]').innerText(),'Chưa tạo');await p.locator('#create-save').click();await p.locator('#drawer [role="alert"]').waitFor();await p.locator('[data-prop="name"]').click();await p.locator('#editor-value').fill('Nháp cục bộ');await p.locator('#edit-save').click();await p.locator('#create-save').click();assert.match(await p.locator('#drawer [role="alert"]').innerText(),/Chưa thể tạo/);await p.locator('#drawer-close').click();assert.equal(await p.locator('#add-record').evaluate(e=>e===document.activeElement),true);
  for(const mode of ['table','drawer','detail']){
   await p.goto(origin+'/bo?testTypes='+mode);await p.locator('[data-type]').first().waitFor();
   if(mode==='detail'){assert.match(await p.locator('[data-type="textarea"]').innerText(),/Dòng thứ hai/);assert.equal(await p.locator('[data-type="multiselect"] .datatag').count(),5);assert.equal(await p.locator('[data-type="multirelation"] .datatag').count(),5);}
   for(const type of ['text','number','currency','date','datetime','select','boolean','relation','multirelation','multiselect','person','textarea','email','url']){
    const anchor=p.locator('[data-type="'+type+'"]');await anchor.scrollIntoViewIfNeeded();await anchor.click();const popup=p.locator('#popover');await popup.waitFor();assert.equal(await popup.locator('h4,p').count(),0);assert.equal(await popup.evaluate(e=>getComputedStyle(e).paddingTop),width<=450?'13.3px':'14.25px');
    const a=await anchor.boundingBox(),b=await popup.boundingBox();assert.ok(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y);assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=1001);await noOverflow(p);
    if(type==='boolean'){await p.locator('#editor-bool').uncheck();await p.locator('#edit-cancel').click();assert.equal(await anchor.locator('[role="img"]').getAttribute('aria-label'),'Có');await anchor.click();await p.locator('#editor-bool').uncheck();await p.locator('#edit-save').click();assert.equal(await anchor.locator('[role="img"]').getAttribute('aria-label'),'Không');}else{if(type==='textarea'||type==='relation')await screenshot(p,'editor-'+mode+'-'+type+'-'+width);await p.keyboard.press('Escape');}
    typed.push({mode,type,width,overlay:true,padding:true});
   }
  }
  await writeFile(output+'/progress.json',JSON.stringify({completedWidth:width,checks:checks.length,typed:typed.length}));console.log(JSON.stringify({completedWidth:width,checks:checks.length,typed:typed.length}));await context.close();
 }
 for(const code of [401,403,409])for(const [key] of f.moduleChecks){status=code;const p=await browser.newPage();await p.goto(origin+'/bo?module='+key);await p.locator('#table-body [role="alert"]').waitFor();assert.equal(await p.locator('#table-body [data-record]').count(),0);await p.close();}status=200;
 for(const mode of ['cross-subject','cross-type','unredacted']){historyMode=mode;const p=await browser.newPage();await p.goto(origin+'/bo');await p.locator('#table-body .row-open').first().click();await p.locator('#full-detail').click();await p.locator('[data-tab="Lịch Sử"]').click();await p.locator('#v24-history-events [role="alert"]').waitFor();assert.equal(await p.locator('.v25-audit-row').count(),0);await p.close();}
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'));
 await writeFile(output+'/receipt.json',JSON.stringify({result:'LOCAL_REACT_PARITY_CHECKS_PASS',sourceHashes:manifest.files,checks,typed,source,requests,errors},null,2));console.log(JSON.stringify({result:'LOCAL_REACT_PARITY_CHECKS_PASS',modules:checks.length,typed:typed.length,output}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
