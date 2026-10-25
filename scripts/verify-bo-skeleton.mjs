// PAP-979 targeted local screenshots; synthetic fixtures, no shared API access.
import {chromium} from '@playwright/test';
import {injectStudentsBridge} from '../lib/bo-skeleton.ts';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const runtime=resolve('public/bo-authority-source'),authority=resolve(process.env.PAP979_AUTHORITY||runtime),output=resolve(process.env.PAP979_SKELETON_EVIDENCE||'.pap979-evidence/skeleton');await mkdir(output,{recursive:true});
const bridge=await readFile(runtime+'/skeleton-bridge.js','utf8'),manifest=JSON.parse(await readFile(runtime+'/manifest.json','utf8'));
for(const [file,sha] of Object.entries(manifest.files)){const actual=await readFile(runtime+'/'+file);assert.ok(actual.equals(await readFile(authority+'/'+file)));assert.equal(createHash('sha256').update(actual).digest('hex'),sha);}
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const students=Array.from({length:103},(_,i)=>({id:id(i+1),displayName:'Học viên '+String(i+1).padStart(3,'0'),status:'ACTIVE',birthYear:2017,activePaths:[{displayName:'Artchitect'}],houseMember:i%2===0}));
const classes=Array.from({length:3},(_,i)=>({id:id(300+i),operationalName:['Lớp đầu tuần','Lớp piano · kiểm tra tên dài và dấu tiếng Việt','Workshop cuối tuần'][i],pathProgramId:id(900),centerId:id(901),weekdayIso:i+1,windowStartsLocal:'16:00',windowEndsLocal:'17:30',optimalConcurrentCapacity:4,deliveryTopology:'FIXED_COHORT',status:'ACTIVE'}));
const subscriptions=classes.map((_,i)=>({id:id(400+i),studentDisplayName:students[i].displayName,pathDisplayName:'Artchitect',lifecycle:'ACTIVE',weeklyCommitment:1,effectiveAvailableUnits:12,serviceStartsOn:'2026-10-25',contractualEndsOn:'2027-01-17',commercialReference:'UI TEST '+i}));
const enrollments=classes.map((c,i)=>({id:id(500+i),subscriptionId:subscriptions[i].id,runningClassId:c.id,runningClassName:c.operationalName,studentDisplayName:students[i].displayName,pathDisplayName:'Artchitect',effectiveFromLocalDate:'2026-10-25',effectiveUntilExclusiveLocalDate:null,plannedEntryLocalTime:null,plannedDurationMinutes:null}));
const staff=classes.map((c,i)=>({id:id(600+i),displayLabel:'Nhân sự '+i,status:'active',department:'Test',roleLabel:'Review'}));
const terms=[{id:id(800),centerId:id(901),displayName:'Term Test'}],termWeeks=classes.map((c,i)=>({id:id(810+i),termId:id(800),code:'W'+i,ordinal:i+1,startDate:'2026-10-01',endDate:'2026-10-07',rhythmKey:'TEST'}));
const visits=classes.map((c,i)=>({id:id(820+i),centerId:id(901),student:{displayName:students[i].displayName},center:{displayName:'Test'},status:'CLOSED',checkedInAt:'2026-10-01T01:00:00Z',checkedOutAt:'2026-10-01T02:00:00Z',durationSeconds:3600}));
const timekeeping=staff.map((v,i)=>({id:id(830+i),centerId:id(901),staff:v,status:'CLOSED',workDate:'2026-10-01',recorded:{checkInAt:'2026-10-01T01:00:00Z',checkOutAt:'2026-10-01T02:00:00Z'},effective:{checkInAt:'2026-10-01T01:10:00Z',checkOutAt:'2026-10-01T02:00:00Z',durationSeconds:3000}}));
const periods=classes.map((c,i)=>({id:id(840+i),centerId:id(901),name:'Salary Period '+i,startDate:'2026-10-01',endDate:'2026-10-15',status:'ACTIVE',dateLocked:false,version:1}));
const worlds=classes.map((c,i)=>({id:id(850+i),displayName:'World '+i,key:'world-'+i,worldType:'OTHER',status:'DRAFT',scenes:[],version:1}));
const items=classes.map((c,i)=>({id:id(860+i),displayName:'Item '+i,key:'item-'+i,itemType:'WEARABLE',slot:'HEADWEAR',gender:'ALL',rarityStars:3,variantCount:0,status:'DRAFT'}));
const sets=classes.map((c,i)=>({id:id(870+i),displayName:'Set '+i,key:'set-'+i,memberCount:0,status:'DRAFT',version:1}));
const users=staff.map((v,i)=>({id:id(880+i),email:'test'+i+'@example.invalid',staffMemberId:v.id,status:'active',assignments:[]})),roles=staff.map((v,i)=>({id:id(890+i),displayName:'Role '+i,roleKey:'role-'+i,roleType:'custom',status:'active',permissionCount:0,assignmentCount:0}));
const audits=classes.map((c,i)=>({id:id(920+i),action:'REAL_ACTION_'+i,occurredAt:'2026-10-01T01:00:00Z',actorType:'user',actorId:id(880),subjectType:'role',subjectId:id(890),outcome:'success',requestId:'request-'+i,payload:{}}));
const moduleChecks=[['students','Students',103,6],['classes','Running Classes',3,9],['subscriptions','Subscriptions',3,9],['enrollments','Enrollments',3,10],['visits','Student Visit',3,7],['staffs','Staffs',3,5],['termWeeks','Term Week',3,8],['timekeeping','Timekeeping',3,10],['salaryPeriods','Salary Period',3,8],['worlds','Pinoria World',3,8],['catalog','Catalog',3,9],['sets','Set',3,6],['users','Users',3,5],['roles','Roles',3,7],['audits','Audits',3,9]];
let status=200;const apiRequests=[],pageErrors=[];
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){apiRequests.push({method:req.method,path:u.pathname,query:u.search});assert.equal(req.method,'GET');let data;
if(u.pathname==='/api/bo/learners')data=u.searchParams.has('beforeStudentId')?students.slice(100):students.slice(0,100);
else if(u.pathname==='/api/bo/delivery/bootstrap-state')data={runningClasses:classes,terms,termWeeks,paths:[{id:id(900),displayName:'Artchitect'}],centers:[{id:id(901),displayName:'Cơ sở test'}]};
else if(u.pathname==='/api/bo/subscriptions')data={items:subscriptions,limit:100,nextCursor:null};
else if(u.pathname==='/api/bo/school/enrollments')data={items:enrollments,limit:100,nextCursor:null};else if(u.pathname==='/api/bo/centers')data=[{id:id(901),displayName:'Test'}];
else if(u.pathname==='/api/bo/workforce/timekeeping/centers')data=[{id:id(901),displayLabel:'Test'}];
else if(u.pathname==='/api/bo/workforce/staff-records')data=staff;
else if(u.pathname==='/api/bo/student-visits')data={data:visits,total:3};
else if(u.pathname==='/api/bo/workforce/timekeeping')data={data:timekeeping,nextCursor:null};
else if(u.pathname==='/api/bo/workforce/payroll/periods')data={data:periods,total:3,nextOffset:null};
else if(u.pathname==='/api/bo/pinoria/worlds')data={worlds};
else if(u.pathname==='/api/bo/pinoria/ward/catalog')data={items,variants:[]};
else if(u.pathname==='/api/bo/pinoria/ward/sets')data={sets};
else if(u.pathname==='/api/bo/access/users')data=users;
else if(u.pathname==='/api/bo/access/roles')data=roles;
else if(u.pathname==='/api/bo/access/audit')data=audits;
else throw Error('Unexpected API '+u.pathname);
res.writeHead(status,{'content-type':'application/json'});return res.end(JSON.stringify(status===200?{data,...(u.pathname==='/api/bo/access/audit'?{page:{limit:100,offset:0,total:3,hasNext:false}}:{})}:{error:{message:'fixture denial'}}));}
const name=u.pathname==='/bo'?'playground.html':u.pathname.split('/').at(-1),file=resolve(runtime,name);if(!file.startsWith(runtime+sep))throw Error('outside fixture');let body=await readFile(file);
if(name==='playground.js')body=Buffer.from(injectStudentsBridge(body.toString(),bridge));if(name==='playground.html')body=Buffer.from(body.toString().replace('<head>','<head><base href="/bo-skeleton/">').replace('<script src="./playground.js">','<script src="./school-adapters.js"></script><script src="./playground.js">'));
res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'})[extname(file)]||'application/octet-stream'});res.end(body);}catch(e){res.writeHead(404);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),checks=[];
async function shot(p,name,selector){await p.mouse.move(-100,-100);await p.evaluate(()=>document.fonts.ready);await p.locator(selector).screenshot({path:output+'/'+name+'.png',animations:'disabled'});}
try{for(const width of [390,768,1440]){const context=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>pageErrors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
for(const [schoolKey,label,count,fields] of moduleChecks){const start=apiRequests.length,prefix=schoolKey+'-'+width;await p.goto(origin+'/bo'+(schoolKey==='students'?'':'?module='+schoolKey));await p.locator('#table-body .row-open').first().waitFor();assert.equal(new URL(p.url()).pathname,'/bo');assert.equal(await p.locator('#list-screen h1').textContent(),label);
assert.deepEqual(await p.locator('#lab-nav a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),moduleChecks.map(([key])=>key==='students'?'/bo':'/bo?module='+key));
assert.equal(await p.locator('#table-count').textContent(),count+' bản ghi');assert.equal(await p.locator('#add-record').isDisabled(),true);await p.screenshot({path:output+'/'+prefix+'-shell.png',fullPage:true,animations:'disabled'});await shot(p,prefix+'-table','#list-screen');
await p.locator('#settings-btn').click();await p.locator('[data-settings="filters"]').click();await p.locator('#add-rule').click();await p.locator('#rule-rows .rule-row').waitFor();await p.locator('#clear-rules').click();await p.locator('#settings-close').click();
await p.locator('#table-body .row-open').first().click();await p.locator('#drawer.open').waitFor();await shot(p,prefix+'-drawer','#drawer');await p.locator('#full-detail').click();await p.locator('#detail-screen:not(.hidden)').waitFor();assert.equal(await p.locator('.v24-prop-item').count(),fields);
for(const [index,tab] of ['Detail','Chuyên Sâu','Lịch Sử'].entries()){await p.locator('[data-tab="'+tab+'"]').click();await shot(p,prefix+'-'+index,'#detail-screen');}
assert.equal(await p.locator('.v25-audit-row').count(),0);assert.match(await p.locator('#detail-body').textContent(),/chưa kết nối/);assert.equal(apiRequests.length-start,['students','visits','timekeeping','salaryPeriods'].includes(schoolKey)?2:1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push({schoolKey,width,table:true,quickView:true,threeTabs:true,fields,documentOverflow:false});}await context.close();}
for(const code of [403,409])for(const [schoolKey] of moduleChecks){status=code;const p=await browser.newPage();await p.goto(origin+'/bo?module='+schoolKey);await p.locator('#table-body [role="alert"]').waitFor();assert.equal(await p.locator('#table-body [data-record]').count(),0);await p.close();}assert.deepEqual(pageErrors,[]);assert.ok(apiRequests.every(r=>r.method==='GET'));await writeFile(output+'/receipt.json',JSON.stringify({result:'LOCAL_VISUAL_CAPTURE_AND_CONTRACT_PASS',baseline:'Hồ sơ đăng ký only; immutable CSS/source, shared renderer; screenshots reviewed separately',sourceHashes:manifest.files,checks,apiRequests},null,2));console.log(JSON.stringify({result:'LOCAL_VISUAL_CAPTURE_AND_CONTRACT_PASS',checks:checks.length,evidence:output}));}finally{await browser.close();await new Promise(r=>server.close(r));}
