// PAP-1461 · Epic PAP-184 / PLT-UI-GOVERNANCE
// Protected PR CI: actual browser geometry with compiled BO CSS authority.
// Synthetic G3 contract is NOT authenticated Staging acceptance.
// Reuse inspectListboxGeometry for other registered BO/HO/TOS controls.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {G3_VIEWPORTS,inspectListboxGeometry} from './pap1461-visual-geometry.mjs';

const root=resolve(import.meta.dirname,'..');
const evidence=resolve(process.env.PAP1461_EVIDENCE_DIR||'test-results/pap1461');
const read=relative=>readFileSync(resolve(root,relative),'utf8');
const BO_SOURCE='public/bo-authority-source';
const BO_CONSUMER='app/bo/pinoria-avatars/CreateSelfDrawer.tsx';
const CONTRACT=Object.freeze({
 name:'PAP-1754 BO Avatar Person option listbox',
 listSelector:'#drawer [data-avatar-person-options]',
 optionSelector:'[role="option"]',minCount:4,
 minHitHeight:44,expectedAlign:'left',maxOverflowPx:2,
});
const samples=[
 ['Manager mock','STAFF','Đã có Avatar'],
 ['[QA PAP-1232] PNR-WARD FSG2 PAP-1689','LEARNER','Đã có Avatar'],
 ['[QA PAP-1232] Student PAP-1370 E2E Renamed 20261105','LEARNER','Đã có Avatar'],
 ['[QA PAP-1232] PNR-AVATAR-CRUD FSG2 PAP-1748','LEARNER','Đã có Avatar'],
];
function safe(value){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function fixtureHtml(){
 const options=samples.map((p,i)=>
  '<button type="button" class="secondary-btn ps-avatar-person-option" role="option" aria-selected="'+(i===0)+'">'+
  '<span style="display:grid;gap:3px;min-width:0;"><strong>'+safe(p[0])+'</strong><small>'+safe(p[1])+'</small></span>'+
  '<span class="ps-avatar-person-option-state">'+safe(p[2])+'</span></button>').join('\n');
 return '<!doctype html><html data-bo-ui-authority="v25" lang="vi"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body style="margin:0;padding:10px;background:#141414"><div id="drawer">'+
 '<div style="width:min(360px,calc(100vw - 140px));min-width:0;">'+
 '<div role="listbox" aria-label="Chọn Person" data-avatar-person-options=""'+
 ' style="display:grid;gap:5px;min-width:0;box-sizing:border-box;">'+options+
 '</div></div></div></body></html>';
}
function guardSource(){
 const source=read(BO_CONSUMER),authority=read(BO_SOURCE+'/bo-form-extension.css');
 const compiled=read(BO_SOURCE+'/bo-scoped.css');
 assert.match(source,/className="secondary-btn ps-avatar-person-option"/);
 assert.match(source,/data-avatar-person-options=""/);
 assert.match(source,/role="option"/);
 assert.match(source,/className="ps-avatar-person-option-state"/);
 assert.match(authority,/#drawer button\.ps-avatar-person-option\.secondary-btn/);
 assert.match(compiled,/#drawer button\.ps-avatar-person-option\.secondary-btn/);
 assert.match(compiled,/PAP-1754/);
 return {base:read(BO_SOURCE+'/styles.css'),compiled};
}
async function launch(){
 try{return await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});}
 catch(primary){
  try{return await chromium.launch({headless:true,args:['--no-sandbox']});}
  catch(secondary){throw new Error('PAP-1461 browser unavailable: Chrome '+primary.message+'; Chromium '+secondary.message);}
 }
}
async function main(){
 mkdirSync(evidence,{recursive:true});
 const {base,compiled}=guardSource();
 const browser=await launch(),checks=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:900},locale:'vi-VN'});
  for(const width of G3_VIEWPORTS){
   await page.setViewportSize({width,height:900});
   await page.setContent(fixtureHtml(),{waitUntil:'load'});
   await page.addStyleTag({content:base+'\n'+compiled});
   const verdict=await inspectListboxGeometry(page,CONTRACT);
   checks.push({width,...verdict});
   await page.screenshot({path:resolve(evidence,'avatar-options-'+width+'.png')});
   assert.equal(verdict.pass,true,
    'PAP-1461 registered Avatar option G3 width '+width+': '+verdict.issues.join(', '));
  }
  // Old fixed-height action button must fail even with no document overflow.
  await page.setViewportSize({width:390,height:900});
  await page.setContent(fixtureHtml(),{waitUntil:'load'});
  await page.addStyleTag({content:base+'\n'+compiled});
  await page.addStyleTag({content:'#drawer button.ps-avatar-person-option.secondary-btn {height:36px;min-height:36px;text-align:center;overflow:hidden;}'});
  const old=await inspectListboxGeometry(page,CONTRACT);
  await page.screenshot({path:resolve(evidence,'negative-old-36px.png')});
  assert.equal(old.pass,false,'PAP-1461 negative control: old 36px CSS must FAIL');
  assert.ok(old.issues.some(x=>/HIT_TARGET_TOO_SHORT|CHILD_OUTSIDE_OPTION|GLYPH_OUTSIDE_OPTION|TEXT_ALIGNMENT/.test(x)),
    'PAP-1461 old-CSS negative must fail for option geometry: '+old.issues.join(','));
  // Removing the compiled authority stylesheet must fail, not silently pass with generic buttons.
  await page.setContent(fixtureHtml(),{waitUntil:'load'});
  await page.addStyleTag({content:base});
  const missing=await inspectListboxGeometry(page,CONTRACT);
  assert.equal(missing.pass,false,'PAP-1461 negative control: missing authority must FAIL');
  const report={jira:'PAP-1461',epic:'PAP-184 / PLT-UI-GOVERNANCE',
    pilot:'PAP-1754 / PAP-1705 PNR-AVATAR-CRUD',
    kind:'SYNTHETIC_BROWSER_CI_NOT_AUTHENTICATED_STAGING',passed:checks.length,
    widths:G3_VIEWPORTS,negativeControls:{old36px:old.issues,missingAuthority:missing.issues},checks};
  writeFileSync(resolve(evidence,'receipt.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PAP1461_G3_GUARD_PASS',pilot:report.pilot,widths:G3_VIEWPORTS,
    negativeControls:{old36px:'FAIL_AS_EXPECTED',missingAuthority:'FAIL_AS_EXPECTED'},artifacts:evidence}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error('PAP1461_G3_GUARD_FAIL',error.stack||error);process.exitCode=1;});
