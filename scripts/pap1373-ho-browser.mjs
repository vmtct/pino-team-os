import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('node_modules/.cache/pap1373');mkdirSync(out,{recursive:true});
await build({entryPoints:['e2e/fixtures/pap1373-termweek-entry.tsx'],bundle:true,outfile:out+'/bundle.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'css'},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'warning'});
const css=readFileSync('public/ho-authority-source/ho-scoped.css','utf8')+'\n'+readFileSync(out+'/bundle.css','utf8');
const html='<!doctype html><html lang="vi" data-surface="ho" data-bo-ui-authority="v25"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>'+css+'</style></head><body><div id="app" data-surface="ho" data-bo-ui-authority="v25"></div><script>'+readFileSync(out+'/bundle.js','utf8').replaceAll('</script>','<\/script>')+'</script></body></html>';
const origin='https://ho.staging.pinohouse.art',base='/api/ho/workforce/global-termweeks',id='01900000-0000-7000-8000-000000000001',termId='01900000-0000-7000-8000-000000000002',at='2026-11-01T00:00:00.000Z';
const parent={id:termId,name:'Học kỳ kiểm thử PAP-1373',startDate:'2026-11-01',endDate:'2026-11-30'};
const initial={id,termId,name:parent.name+' · W01',code:'W01',ordinal:1,startDate:'2026-11-01',endDate:'2026-11-07',rhythmKey:'BUILD',createdAt:at,updatedAt:at,global_week_registration_locked:false,lockVersion:0,referenceCount:1,deletionEligible:false};
const evidence=process.env.PAP1373_EVIDENCE_DIR||out;mkdirSync(evidence,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});const results=[];
try{for(const width of [1440,768,390]){
 let week={...initial},history=[],apiMode='ready',postCount=0;const errors=[];
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(req.resourceType()==='document')return route.fulfill({contentType:'text/html',body:html});
  if(p==='/api/bo/context')return route.fulfill({json:{data:{surface:'BO',entitled:true,userId:'pap1373-founder',displayName:'Founder QA',email:'qa@pino.invalid',permissionKeys:['team.bo.access','operating_cycle.global_week.manage','operating_cycle.global_week.lock']}}});
  if(p===base&&req.method()==='GET')return route.fulfill({status:apiMode==='error'?503:200,json:apiMode==='error'?{error:{code:'UNAVAILABLE'}}:url.searchParams.get('catalog')==='1'?{data:{terms:[parent],weeks:[week]}}:{data:apiMode==='empty'?[]:[week]}});
  if(p===base+'/'+id&&req.method()==='GET')return route.fulfill({json:{data:{...week,parent,history}}});
  if(p==='/api/ho/workforce/global-week-registration'&&req.method()==='POST'){postCount++;const b=req.postDataJSON();assert.equal(typeof b.reason,'string');assert.ok(b.reason.trim());assert.equal(b.expectedVersion,week.lockVersion);week={...week,global_week_registration_locked:b.locked,lockVersion:week.lockVersion+1};history=[{id,occurredAt:at,actorId:'Founder QA',action:'WORKFORCE_GLOBAL_TERM_WEEK_REGISTRATION_LOCK_CHANGED',reason:b.reason,changes:[{field:'global_week_registration_locked',before:!b.locked,after:b.locked},{field:'auditReason',before:null,after:b.reason}]}];return route.fulfill({json:{data:{termWeekId:id,locked:b.locked,version:week.lockVersion}}});}
  if(req.method()==='POST'&&p.startsWith(base)){postCount++;return route.fulfill({status:409,json:{error:{code:'TERM_WEEK_CONFLICT'}}});}
  return route.fulfill({status:204,body:''});
 });
 await page.goto(origin+'/ho/workforce/term-weeks');await page.getByRole('button',{name:'Tạo Global TermWeek',exact:true}).waitFor();
 await page.screenshot({path:resolve(evidence,'pap1373-table-'+width+'.png'),fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1,'Table document overflow '+overflow);
 // Shared TDD Quick View opener, then actual detail navigation.
 const opener=page.locator('button[data-open]').first();await opener.click();await page.getByRole('dialog').waitFor();
 await page.screenshot({path:resolve(evidence,'pap1373-drawer-'+width+'.png'),fullPage:true});
 const detailButton=page.getByRole('button',{name:/Full Detail/i}).first();await detailButton.click();await page.getByRole('tab',{name:'Tổng quan',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Lịch sử',exact:true}).click();await page.getByRole('tab',{name:'Tổng quan',exact:true}).focus();await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'Lịch sử',exact:true}).getAttribute('tabindex'),'0');
 await page.getByText('Chưa có sự kiện lịch sử được phép xem.',{exact:true}).waitFor();
 await page.screenshot({path:resolve(evidence,'pap1373-detail-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Xóa',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Lý do *',{exact:true}).fill('Guarded delete must remain unavailable');assert.equal(await dialog.getByRole('button',{name:'Xác nhận xóa',exact:true}).isDisabled(),true);await dialog.getByRole('button',{name:'Hủy',exact:true}).click();assert.equal(postCount,0);
 await page.getByRole('button',{name:'Global Lock ON/OFF',exact:true}).click();await page.getByRole('checkbox',{name:'Khóa đăng ký toàn hệ thống',exact:true}).check();const save=page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true});assert.equal(await save.isDisabled(),true);await page.getByLabel('Lý do *',{exact:true}).fill('PAP-1373 browser ON');await save.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(week.global_week_registration_locked,true);
 await page.getByRole('button',{name:'Global Lock ON/OFF',exact:true}).click();await page.getByRole('checkbox',{name:'Khóa đăng ký toàn hệ thống',exact:true}).uncheck();await page.getByLabel('Lý do *',{exact:true}).fill('PAP-1373 browser OFF');await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(week.global_week_registration_locked,false);await page.getByRole('tab',{name:'Lịch sử',exact:true}).click();await page.getByText('PAP-1373 browser OFF',{exact:true}).waitFor();await page.screenshot({path:resolve(evidence,'pap1373-history-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();assert.equal(await page.getByLabel('Global Term *',{exact:true}).isDisabled(),true);await page.getByLabel('Lý do *',{exact:true}).fill('Stale edit');await page.getByRole('dialog').getByRole('button',{name:'Lưu',exact:true}).click();await page.getByRole('alert').filter({hasText:/tham chiếu|thay đổi/}).waitFor();await page.screenshot({path:resolve(evidence,'pap1373-error-'+width+'.png'),fullPage:true});await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();
 // Escape closes the shared form, with focus restoration and trap scoped to it.
 await page.goto(origin+'/ho/workforce/term-weeks');await page.getByRole('button',{name:'Tạo Global TermWeek',exact:true}).click();
 await page.getByRole('dialog').waitFor();await page.getByLabel('Mã tuần *',{exact:true}).waitFor();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.querySelector('[role=dialog]')?.contains(document.activeElement)),true);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 apiMode='empty';await page.goto(origin+'/ho/workforce/term-weeks');await page.getByText('Không có bản ghi phù hợp',{exact:true}).waitFor();
 await page.screenshot({path:resolve(evidence,'pap1373-empty-'+width+'.png'),fullPage:true});
 apiMode='error';await page.reload();await page.getByRole('alert').first().waitFor();
 await page.screenshot({path:resolve(evidence,'pap1373-loading-error-'+width+'.png'),fullPage:true});
 assert.deepEqual(errors,[]);results.push({width,status:'PASS',tableOverflow:overflow,lockPosts:2,deletePosts:0,keyboard:true,fixtureOnly:true});await page.close();
 }
 writeFileSync(resolve(evidence,'pap1373-ui-results.json'),JSON.stringify({kind:'LOCAL_UI_FIXTURE_NOT_STAGING_E2E',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
