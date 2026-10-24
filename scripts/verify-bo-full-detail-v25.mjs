// PAP-979 local-only fixtures. Never contacts Core or shared staging.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const authority=process.env.PAP979_AUTHORITY;
const output=resolve(process.env.PAP979_EVIDENCE||'.pap979-evidence');
await mkdir(output,{recursive:true});
const runtime=resolve('public/bo-ui-replica');
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const base=pathname.startsWith('/authority/')?authority:runtime;
  if(!base)throw Error('authority absent');
  const file=resolve(base,'.'+pathname.replace(/^\/authority/,''));
  if(!file.startsWith(resolve(base)+sep))throw Error('outside fixture');
  res.setHeader('content-type',({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const receipts=[],visual=[],errors=[];
const digest=b=>createHash('sha256').update(b).digest('hex');
async function context(width){
 const c=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'});
 const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
 return {c,p};
}
async function open(p){await p.waitForFunction(()=>document.querySelector('#table-body .row-open'));await p.locator('#table-body .row-open').first().click();await p.locator('#full-detail').click();await p.waitForFunction(()=>getComputedStyle(document.querySelector('#drawer-scrim')).opacity==='0');}
try{
 for(const width of [390,768,1440]){
  const {c,p}=await context(width);await p.goto(origin+'/playground.html');await open(p);
  const shots={};
  for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){
   await p.locator('[data-tab="'+tab+'"]').click();await p.evaluate(()=>document.fonts.ready);
   const name='registration-'+width+'-'+['Detail','Chuyên Sâu','Lịch Sử'].indexOf(tab);
   shots[tab]=await p.locator('#detail-screen').screenshot({path:output+'/'+name+'.png'});
   assert.equal(await p.locator('#detail-body > aside,#detail-body .detail-explain').count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  if(authority){
   await p.goto(origin+'/authority/playground.html');await open(p);
   for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){
    await p.locator('[data-tab="'+tab+'"]').click();await p.evaluate(()=>document.fonts.ready);
    const b=await p.locator('#detail-screen').screenshot({path:output+'/authority-'+width+'-'+['Detail','Chuyên Sâu','Lịch Sử'].indexOf(tab)+'.png'});
    visual.push({width,tab,equal:shots[tab].equals(b),runtime:digest(shots[tab]),authority:digest(b)});
   }
  }
  await c.close();
  for(const key of ['students','classes']){
   const {c,p}=await context(width);await p.goto(origin+'/playground.html?module='+key);await open(p);
   for(const [index,tab] of ['Detail','Chuyên Sâu','Lịch Sử'].entries()){
    await p.locator('[data-tab="'+tab+'"]').click();await p.locator('#detail-screen').screenshot({path:output+'/'+key+'-'+width+'-'+index+'.png'});
    assert.equal(await p.locator('#detail-body .detail-explain').count(),0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(tab==='Detail'){
     const fields=await p.evaluate(()=>window.PinoBOPilotAdapters[new URLSearchParams(location.search).get('module')].fields.length);
     assert.equal(await p.locator('.v24-prop-item').count(),fields);
     assert.equal(await p.locator('[data-detail-edit="id"]').count(),0);
    }
    if(tab==='Lịch Sử'){
     assert.equal(await p.locator('.v24-history-scope,.v24-audit-contract').count(),0);
     const row=await p.locator('#table-body [data-record]').first().getAttribute('data-record');
     for(const subject of await p.locator('[data-audit-subject]').evaluateAll(es=>es.map(e=>e.dataset.auditSubject)))assert.equal(subject,row);
     await p.locator('#v24-history-search').fill('no such event');assert.equal(await p.locator('.v25-audit-row').count(),0);
    }
   }
   await p.locator('#back-to-list').click();
   await p.locator('#table-body .row-open').nth(1).click();await p.locator('#full-detail').click();
   assert.equal(await p.locator('[data-tab="Detail"].selected').count(),1);
   await p.locator('[data-tab="Lịch Sử"]').click();assert.equal(await p.locator('#v24-history-search').inputValue(),'');
   receipts.push({key,width,status:'MOCK_CONTRACT_PASS'});await c.close();
  }
 }

 for(const width of [390,768,1440])for(const key of ['students','classes'])for(const manager of [true,false]){
  const {c,p}=await context(width),calls=[];
  const id='019a1234-5678-7000-8000-123456789abc';
  let student={id,displayName:'An',status:'ACTIVE',version:3,birthYear:2018,activePaths:[{displayName:'Art'}],activeSubscriptions:1,houseMember:true};
  let klass={id,centerId:id,pathProgramId:id,learningSpaceId:id,operationalName:'Art',weekdayIso:1,windowStartsLocal:'18:00',windowEndsLocal:'19:00',deliveryTopology:'FIXED_COHORT',defaultParticipationMinutes:60,optimalConcurrentCapacity:8,hardConcurrentCapacity:12,status:'ACTIVE',version:2};
  let failure=null,patches=0,auditMode='denied';
  await p.route('**/api/bo/**',async route=>{
   const req=route.request(),u=new URL(req.url());calls.push({path:u.pathname,method:req.method(),query:u.search});
   let data;
   if(u.pathname.endsWith('/audit/subject')){
    assert.equal(u.searchParams.get('subject_type'),key==='students'?'student_profile':'running_class');
    assert.equal(u.searchParams.get('subject_id'),id);assert.equal(u.searchParams.get('limit'),'50');
    if(auditMode==='denied'||auditMode===409||auditMode===500)return route.fulfill({status:auditMode==='denied'?403:auditMode,contentType:'application/json',body:JSON.stringify({error:{}})});
    const next=u.searchParams.has('cursor');
    data={events:auditMode==='empty'?[]:[{id:next?'019a1234-5678-7000-8000-123456789aaa':'019a1234-5678-7000-8000-123456789aab',subject_type:key==='students'?'student_profile':'running_class',subject_id:auditMode==='wrong'?'019a1234-5678-7000-8000-123456789def':id,occurred_at:next?'2026-10-23T09:00:00.000Z':'2026-10-24T09:00:00.000Z',actor_id:null,actor_label:'Nhân viên',action:key==='students'?'Cập nhật học viên':'Cập nhật lớp học',description:null,before:null,after:null,outcome:'succeeded',redacted:true}],nextCursor:auditMode==='success'&&!next?'opaque-cursor':null};
   }else if(req.method()==='PATCH'){
    patches++;if(failure==='network')return route.abort();
    if(failure)return route.fulfill({status:failure,contentType:'application/json',body:JSON.stringify({error:{}})});
    const body=req.postDataJSON();
    if(key==='students'){assert.equal(body.expectedVersion,student.version);student={...student,displayName:body.displayName,version:student.version+1};}
    else {assert.equal(body.expectedVersion,klass.version);klass={...klass,...body,version:klass.version+1};}
    data={};
   }else if(u.pathname.endsWith('/context'))data={surface:'BO',entitled:true,displayName:'Contract actor',permissionKeys:[key==='students'?'student.profile.view':'delivery.schedule.view',...(manager?[key==='students'?'student.profile.manage':'delivery.schedule.manage','bo.shared_view.manage']:[])]};
   else if(u.pathname.includes('/views/'))data=[];
   else if(u.pathname.endsWith('/learners'))data=[student];
   else if(u.pathname.endsWith('/lifecycle'))data={student};
   else if(u.pathname.endsWith('/bootstrap-state'))data={runningClasses:[klass]};
   else if(u.pathname.endsWith('/running-classes'))data=[klass];
   else throw Error('Unexpected fixture endpoint '+u.pathname);
   return route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
  });
  await p.goto(origin+'/playground.html?module='+key+'&data=core&context=keep#record');
  await open(p);
  assert.equal(await p.locator('[data-detail-edit="id"]').count(),0);
  assert.equal(await p.locator('[data-detail-edit]').count(),manager?(key==='students'?1:2):0);
  if(manager){
   const original=key==='students'?'An':'Art';
   for(const status of [403,409,'network']){
    failure=status;
    await p.locator('[data-detail-edit="name"]').click();await p.locator('#editor-value').fill('Rejected');
    await p.locator('#edit-save').click();await p.waitForFunction(()=>document.querySelector('#edit-error')?.textContent);
    assert.equal(await p.locator('#detail-title').innerText(),original);
    assert.doesNotMatch(await p.locator('#toast').innerText(),/Đã lưu thay đổi/);
    await p.locator('#edit-cancel').click();
   }
   assert.equal(patches,3);failure=null;
   await p.locator('[data-detail-edit="name"]').click();await p.locator('#editor-value').fill('Confirmed');await p.locator('#edit-save').click();
   await p.waitForFunction(()=>document.querySelector('#detail-title').textContent==='Confirmed');
   assert.equal(patches,4);assert.equal(calls.at(-1).method,'GET');
   if(key==='students')assert.match(await p.locator('#detail-body').innerText(),/Art/);
   if(key==='classes'){
    await p.locator('[data-detail-edit="capacity"]').click();await p.locator('#editor-value').fill('10');await p.locator('#edit-save').click();
    await p.waitForFunction(()=>document.querySelector('[data-detail-edit="capacity"]').textContent.includes('10'));
    assert.equal(klass.optimalConcurrentCapacity,10);
   }
  }
  await p.locator('[data-tab="Lịch Sử"]').click();
  await p.waitForFunction(()=>document.querySelector('#v24-history-events [role="alert"]'));
  assert.equal(await p.locator('.v25-audit-row').count(),0);
  assert.equal(calls.filter(x=>x.path.includes('audit')).length,1);
  auditMode='success';await p.locator('#v24-history-search').fill('Cập nhật');
  await p.waitForFunction(()=>document.querySelectorAll('.v25-audit-row').length===1);
  assert.match(await p.locator('.v25-audit-who').innerText(),/Nhân viên/);
  assert.equal(await p.locator('#detail-body .v24-demo-label').count(),0);
  assert.equal(await p.locator('.v25-audit-row').getAttribute('data-audit-subject'),id);
  assert.match(calls.at(-1).query,/query=/);
  await p.locator('#fd-history-next').click();await p.waitForFunction(()=>document.querySelectorAll('.v25-audit-row').length===2);
  assert.match(calls.at(-1).query,/cursor=opaque-cursor/);
  await p.locator('#detail-screen').screenshot({path:output+'/core-history-'+key+'-'+(manager?'manager':'staff')+'-'+width+'.png'});
  for(const mode of [409,500,'wrong']){
   auditMode=mode;await p.locator('#v24-history-search').fill(String(mode));
   await p.waitForFunction(()=>document.querySelector('#v24-history-events [role="alert"]'));
   assert.equal(await p.locator('.v25-audit-row').count(),0);
  }
  auditMode='empty';await p.locator('#v24-history-search').fill('empty');
  await p.waitForFunction(()=>document.querySelector('#v24-history-events')?.textContent.includes('Không có sự kiện'));
  assert.equal(calls.some(x=>x.path.includes('audit')&&x.path!=='/api/bo/audit/subject'),false);
  await p.locator('#back-to-list').click();assert.match(p.url(),/context=keep/);assert.match(p.url(),/#record$/);
  if(!manager)assert.equal(patches,0);
  receipts.push({key,width,actor:manager?'MANAGER':'STAFF',status:'CORE_CONTRACT_FIXTURE_PASS',realAPI:false});await c.close();
 }

 assert.deepEqual(errors,[]);
 const result={mode:'LOCAL_ONLY',receipts,visual,errors,visualParity:authority&&visual.every(v=>v.equal)?'PASS':'PENDING',live:'LIVE_VERIFICATION_PENDING'};
 await writeFile(output+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(authority)assert.ok(visual.every(v=>v.equal),'prototype visual parity mismatch; inspect retained screenshots');
}finally{await browser.close();await new Promise(r=>server.close(r));}
