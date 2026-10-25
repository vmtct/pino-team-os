// PAP-979 targeted React component/visual fixtures. Local only; never staging proof.
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const baseline = process.env.PAP979_BASELINE;
const output = resolve(process.env.PAP979_EVIDENCE || '.next/pap979-react-evidence');
await mkdir(output, { recursive: true });
const nav = `import React from 'react';
import {useSyncExternalStore} from 'react';
const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};
const change=href=>{history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export const useRouter=()=>({push:change,replace:change,refresh:()=>location.reload()});
export default function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented){e.preventDefault();change(href)}}}>{children}</a>}`;
await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
import {BoLearnersView} from './app/bo/learners/BoLearnersView';
import {BoOperationalView} from './app/bo/BoOperationalView';
import {BoShell} from './app/components/tos-shell/BoShell';
import {boNavigation} from './app/bo/navigation';
import './app/globals.css';import './app/bo/design-system/foundation.css';
createRoot(document.getElementById('root')).render(<BoShell groups={boNavigation}><>{location.pathname.includes('learners')?<BoLearnersView/>:<BoOperationalView view="running-classes"/>}</></BoShell>);`, resolveDir: process.cwd(), loader: 'tsx' },
  outfile: resolve(output, 'fixture.js'), bundle: true, format: 'esm', jsx: 'automatic',
  plugins: [{ name: 'local-fixture', setup(b) {
    b.onResolve({filter: /^next\/(link|navigation)$/}, () => ({path:'navigation',namespace:'fixture'}));
    b.onLoad({filter: /.*/,namespace:'fixture'}, () => ({contents:nav,loader:'jsx',resolveDir:process.cwd()}));
    if (baseline) b.onLoad({filter: /app[\\/](bo|components[\\/]tos-shell)[\\/].*\.(tsx|css)$/}, async ({path}) => {
      const relative=path.slice(process.cwd().length+1).split(sep).join('/');
      try { return {contents:execFileSync('git',['show',`${baseline}:${relative}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}),loader:relative.endsWith('.module.css')?'local-css':relative.endsWith('.css')?'css':'tsx'}; }
      catch { return undefined; }
    });
  }}],
});
const server = createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(path.startsWith('/bo/')) {res.setHeader('content-type','text/html');return res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>');}
    const file=resolve(output,'.'+path);if(!file.startsWith(output+sep))throw Error('outside fixture');
    res.setHeader('content-type',extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const studentId='019d2000-0001-7000-8000-000000000001', classId='019d2000-0001-7000-8000-000000000002';
const student={id:studentId,displayName:'Nguyễn Minh An',status:'ACTIVE',birthYear:2017,birthMonth:5,birthDay:12,birthPrecision:'FULL_DATE',houseMember:false,activeSubscriptions:0,activePaths:[],version:1};
const record={id:classId,centerId:'center-1',pathProgramId:'path-1',learningSpaceId:'space-1',operationalName:'Piano · Thứ Ba',weekdayIso:2,windowStartsLocal:'17:00',windowEndsLocal:'18:00',deliveryTopology:'FIXED_COHORT',defaultParticipationMinutes:60,optimalConcurrentCapacity:6,hardConcurrentCapacity:8,status:'ACTIVE',version:1};
const bootstrap={centers:[{id:'center-1',centerKey:'C1',displayName:'PINO House',timeZone:'Asia/Ho_Chi_Minh',status:'ACTIVE'}],paths:[{id:'path-1',code:'PIANO',displayName:'Piano House',status:'ACTIVE',version:1}],learningSpaces:[{id:'space-1',displayName:'Phòng Piano'}],runningClasses:[record],runningClassBlocks:[],termWeeks:[],upcomingSessions:[]};
const requests=[],errors=[],checks=[];
const browser=await chromium.launch({headless:true});
let passed=false;
async function open(width,pilot,role='manager',historyStatus=200,writeStatus=200) {
  const context=await browser.newContext({viewport:{width,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  let currentStudent={...student},currentClass={...record};
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin)return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    requests.push({method:req.method(),path:url.pathname,query:url.search});
    let data;
    if(req.method()!=='GET'){
      if(writeStatus!==200)return route.fulfill({status:writeStatus,json:{error:{message:'Fixture denied/conflict'}}});
      const body=req.postDataJSON();
      if(url.pathname.includes('/students/')){currentStudent={...currentStudent,displayName:body.displayName,status:body.status,version:currentStudent.version+1};data=currentStudent;}
      else if(url.pathname.includes('running-classes')){currentClass={...currentClass,...body,version:currentClass.version+1};data=currentClass;}
      else return route.fulfill({status:403,json:{error:{message:'No fixture command admitted'}}});
    } else if(url.pathname==='/api/bo/context')data={surface:'BO',entitled:true,userId:'fixture-actor',permissionKeys:['student.profile.view','delivery.schedule.view',...(role==='manager'?['student.profile.manage','delivery.schedule.manage','bo.shared_view.manage']:[])]};
    else if(url.pathname.endsWith('/bootstrap-state'))data={...bootstrap,runningClasses:[currentClass]};
    else if(url.pathname==='/api/bo/learners')data=[currentStudent];
    else if(url.pathname.includes('/lifecycle'))data={student:currentStudent,guardians:[],subscriptions:[],houseMembership:null};
    else if(url.pathname.startsWith('/api/bo/views/'))data=[];
    else if(url.pathname.includes('/pinoria'))data={companions:[],fruitBalance:0,waterSigil:null,operationContext:{visitState:'NONE',openVisit:null,feedAuthorized:false}};
    else if(url.pathname==='/api/bo/audit/subject'){
      if(historyStatus!==200)return route.fulfill({status:historyStatus,json:{error:{message:'Fixture audit denial'}}});
      data={events:[{id:url.searchParams.has('cursor')?'audit-1':'audit-2',subject_type:url.searchParams.get('subject_type'),subject_id:url.searchParams.get('subject_id'),occurred_at:url.searchParams.has('cursor')?'2026-10-24T08:00:00Z':'2026-10-25T08:00:00Z',actor_id:null,actor_label:'Người dùng được bảo vệ',action:'PROFILE_UPDATED',outcome:'succeeded',field:null,before:null,after:null,description:null,redacted:true}],nextCursor:url.searchParams.has('cursor')?null:'fixture-next'};
    } else return route.fulfill({status:403,json:{error:{message:'Unknown local fixture endpoint: '+url.pathname}}});
    return route.fulfill({json:{data}});
  });
  await page.goto(`${origin}/bo/${pilot}`);
  await expect(page.getByRole('button',{name:/Open Quick View/}).first()).toBeVisible();
  return {context,page};
}
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);try{await page.screenshot({path:resolve(output,name+'.png'),fullPage:true,animations:'disabled'});}catch(error){console.error('SCREENSHOT_GEOMETRY',name,await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})));throw error;}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} page overflow`);}
try {
  for(const width of [390,768,1440])for(const pilot of ['learners','running-classes']){
    const {context,page}=await open(width,pilot);
    const name=`${pilot}-${width}`;
    await shot(page,name+'-table');
    await page.getByRole('button',{name:/Open Quick View/}).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    if(pilot==='learners')await expect(page.getByRole('dialog').getByText('Người giám hộ',{exact:true})).toBeVisible().catch(()=>{});
    await shot(page,name+'-drawer');
    await page.getByRole('dialog').getByRole('link',{name:/Full Detail|Mở chi tiết đầy đủ/}).click();
    await expect(page.getByRole('tab',{name:'Detail',exact:true})).toBeVisible();
    for(const tab of ['Detail','Chuyên Sâu','Lịch Sử']){
      await page.getByRole('tab',{name:tab,exact:true}).click();
      if(tab==='Lịch Sử')await expect(page.getByRole('listitem')).toHaveCount(1);
      await shot(page,name+'-'+({Detail:'detail','Chuyên Sâu':'specialized','Lịch Sử':'history'}[tab]));
    }
    if(!baseline){await page.getByRole('button',{name:'Xem thêm'}).click();await expect(page.getByRole('listitem')).toHaveCount(2);}
    checks.push({pilot,width,screenshots:5,kind:'LOCAL_FIXTURE'});await context.close();
  }
  if(!baseline)for(const pilot of ['learners','running-classes']){
    for(const role of ['manager','staff']){
      const {context,page}=await open(1440,pilot,role);
      const id=pilot==='learners'?studentId:classId;
      await page.goto(`${origin}/bo/${pilot}?detail=${id}`);
      const edit=page.getByRole('button',{name:pilot==='learners'?'Chỉnh sửa tên học viên':'Chỉnh sửa tên lớp',exact:true});
      if(role==='staff')await expect(edit).toHaveCount(0);
      else {await edit.click();await page.getByRole('textbox',{name:pilot==='learners'?'Tên học viên':'Tên lớp',exact:true}).fill('Đã cập nhật');await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.getByRole('heading',{name:'Đã cập nhật',exact:true})).toBeVisible();}
      checks.push({pilot,role,readback:role==='manager'?'PASS':'READ_ONLY'});await context.close();
    }
    for(const status of [403,409]){
      const {context,page}=await open(390,pilot,'manager',status,status);
      await page.goto(`${origin}/bo/${pilot}?detail=${pilot==='learners'?studentId:classId}`);
      await page.getByRole('tab',{name:'Lịch Sử',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
      await shot(page,`${pilot}-390-history-${status}`);
      await page.getByRole('tab',{name:'Detail',exact:true}).click();
      await page.getByRole('button',{name:pilot==='learners'?'Chỉnh sửa tên học viên':'Chỉnh sửa tên lớp',exact:true}).click();
      await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
      await shot(page,`${pilot}-390-edit-${status}`);checks.push({pilot,status,failClosed:'PASS'});await context.close();
    }
  }
  assert.deepEqual(errors,[]);
  passed=true;
} finally {
  await writeFile(resolve(output,'receipt.json'),JSON.stringify({result:passed?'PASS':'FAIL',baseline:baseline||null,classification:'LOCAL_REACT_FIXTURE_ONLY',checks,requests,errors},null,2));
  await browser.close();await new Promise(r=>server.close(r));
}
console.log(JSON.stringify({classification:'LOCAL_REACT_FIXTURE_ONLY',checks,errors,output}));
