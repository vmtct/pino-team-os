import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verify,inspectModuleSource,inspectCss,validateSpecial} from './verify-tdd-authority.mjs';
const now=Date.parse('2026-10-28T06:00:00Z');
function schema(surface='BO') {
 const fields=[{key:'name',label:'Name',type:'text',icon:'Aa',width:175,permission:'fixture.read',readOnly:true,capabilities:{display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false}}];
 const sections=[{id:'main',label:'Main',fields:['name']}];
 return {version:1,classification:'TDD_DEFAULT',surface,key:'new',label:'Fixture',group:'Test',fields,capabilities:{read:'fixture.read'},data:{id:'fixture',list:async()=>({rows:[],total:0}),detail:async()=>null},table:{identity:{field:'name',pinned:'left',hideable:false,reorderable:false},columns:[{field:'name',visible:true}],search:{fields:['name'],normalization:'vi-diacritic-insensitive'},filters:{fields:['name'],mode:'flat',logic:'AND'},sort:{fields:['name'],mode:'single',nulls:'last',tieBreak:'record-id'},group:{fields:['name'],mode:'single'},views:{builtIn:[],saved:{kind:'local-ui'},actions:['add','apply','rename','delete','reorder']},pagination:{sizes:[8,15,30],defaultSize:8,mode:'local-ui'},inlineEdit:{fields:[],enabled:false},interaction:{settings:['properties','grouping','filters','quick-views'],quickView:'separate-opener',keyboard:'canonical',undo:'local-ui-only'}},drawer:{density:'one-column',sections,actions:[]},detail:{overview:{sections},businessTabs:[{id:'domain',label:'Domain',kind:'field-group',source:{adapter:'fixture',permission:'fixture.read'},sections}],history:{kind:'unavailable',reason:'Not available'}}};
}
function setup(t,surface='BO') {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pap1071-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const prefix='app/'+surface.toLowerCase()+'/new',file=prefix+'/page.tsx',schemaFile=prefix+'/schema.ts',testFile=prefix+'/profile.test.mjs';
 const put=(f,s)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s);};
 put(file,`import {schema} from './schema'; import {TddRenderer as Shared} from '@/app/components/workspace-renderer/Renderer'; export default function Page(){return <Shared view={{kind:'table',props:{schema}}}/>}`);
 put(schemaFile,'import {TddRegistry} from "@/lib/workspace-schema/registry"; const registry=new TddRegistry(); export const schema=registry.register({});');put(testFile,'');put('lib/workspace-schema/registry.ts','export class TddRegistry {}');put('app/components/workspace-renderer/Renderer.tsx','export function TddRenderer(){return <table/>}');
 const entry={profile:'TDD_DEFAULT',surface,key:'new',route:'/'+surface.toLowerCase()+'/new',file,files:[file,schemaFile],schema:{file:schemaFile,export:'schema'},binding:{file},tests:[testFile]};
 const baseline={routes:[],sourceFiles:['app/components/workspace-renderer/Renderer.tsx']};
 const manifest={modules:[entry],approvals:[]};const m=schema(surface);
 const check=(changed=[file])=>verify(root,{baseline,manifest,changed,now,loadSchema:()=>m,approvals:manifest.approvals});
 return {root,file,schemaFile,testFile,entry,baseline,manifest,m,check,put};
}
for(const surface of ['BO','HO']) test(surface+': registered shared renderer and typed domain slot pass',async t=>{const x=setup(t,surface);assert.deepEqual((await x.check()).errors,[]);});
for(const [label,source] of [
 ['cloned cover','<div className="detail-cover"/>'],['cloned hero template','<div className={`detail-hero`}/>'],['drawer footer','<footer className="drawer-footer"/>'],['two-column drawer','<div className="v24-prop-grid"/>'],['inline width','<div style={{width:500}}/>'],['inline padding','<div style={{padding:20}}/>'],['inline grid','<div style={{gridTemplateColumns:"1fr 1fr"}}/>'],['raw table','<table/>'],['raw dialog','<dialog/>'],['tab semantics','<div role="tablist"/>'],['HTML injection','<div dangerouslySetInnerHTML={{__html:shell}}/>'],['opaque classes','<div className={shell}/>'],['spread shell','<div {...shell}/>']
]) test('AST rejects '+label,()=>assert.ok(inspectModuleSource('module.tsx','export const Slot=()=>'+source).length));
test('AST ignores comments and safe domain content',()=>assert.deepEqual(inspectModuleSource('slot.tsx','// <div className="detail-cover"/>\nexport const Slot=()=> <p className="muted">Domain</p>'),[]));
for(const [label,mutate] of [
 ['reserved overview',m=>m.detail.businessTabs[0].id='overview'],['reserved history',m=>m.detail.businessTabs[0].id='history'],['unknown slot',m=>m.detail.businessTabs[0].kind='custom-jsx'],['unknown field',m=>m.fields[0].type='invented'],['system tab override',m=>m.detail.tabs=[]],['invalid built-in query',m=>m.table.views.builtIn=[{id:'pending',label:'Pending',state:{}}]]
]) test('gate rejects '+label,async t=>{const x=setup(t);mutate(x.m);assert.ok((await x.check()).errors.length);});
test('optional nonempty builtIns and separate saved views remain valid; column count/order not prototype',async t=>{const x=setup(t);x.m.table.views.builtIn=[{id:'pending',label:'Pending',state:{search:'',filters:{logic:'AND',rules:[]},sort:null,group:null,order:['name'],visible:['name'],page:1,pageSize:8}}];assert.deepEqual((await x.check()).errors,[]);});
test('unused schema import cannot substitute for renderer binding',async t=>{const x=setup(t);x.put(x.file,`import {schema} from './schema'; import {TddRenderer} from '@/app/components/workspace-renderer/Renderer'; export default function Page(){return <p/>}`);assert.match((await x.check()).errors.join(),/binding required/);});
test('new unregistered route fails',async t=>{const x=setup(t);x.manifest.modules=[];assert.match((await x.check()).errors.join(),/requires explicit TDD/);});
test('new route cannot self-grandfather',async t=>{const x=setup(t);x.entry.profile='EXISTING_GRANDFATHERED';assert.match((await x.check()).errors.join(),/cannot self-grandfather/);});
test('legacy hotfix and unrelated work do not inherit TDD gate',async t=>{const x=setup(t);x.baseline.routes=[{file:x.file}];x.manifest.modules=[];x.put(x.file,'export default function Page(){return <table style={{width:500}}/>}');assert.deepEqual((await x.check([x.file,'app/tos/hotfix.tsx'])).errors,[]);});
test('explicit migration admission gates old route',async t=>{const x=setup(t);x.baseline.routes=[{file:x.file}];x.put(x.file,'export default function Page(){return <table/>}');assert.ok((await x.check()).errors.length);});
test('imported helper shell is inspected and must be in file fence',async t=>{const x=setup(t);x.put(x.file,fs.readFileSync(path.join(x.root,x.file),'utf8')+"\nimport './helper';");x.put('app/bo/new/helper.tsx','export const Copy=()=> <div className="detail-hero"/>');assert.match((await x.check()).errors.join(),/outside admission fence/);x.entry.files.push('app/bo/new/helper.tsx');assert.match((await x.check()).errors.join(),/reserved shell/);});
test('new shared owner cannot be claimed by module',async t=>{const x=setup(t);x.entry.files.push('app/components/workspace-renderer/Renderer.tsx');assert.match((await x.check()).errors.join(),/cannot claim shared/);});
test('new CSS and important cannot be hidden in helper',async t=>{const x=setup(t);const css='app/bo/new/override.css';x.put(css,'.detail-hero { width: 500px!important }');assert.match((await x.check([css])).errors.join(),/unauthorized surface stylesheet/);x.entry.files.push(css);assert.match((await x.check()).errors.join(),/module CSS/);});
for(const [surface,css] of [['BO','.detail-hero{width:20px}'],['HO',':where(html[data-bo-ui-authority="v25"]) .detail-hero{width:20px}'],['BO',':where(html[data-surface="ho"]) .detail-hero{width:20px}'],['HO',':where(html[data-surface="ho"]) .x, .leak{color:red}']]) test(surface+' CSS leakage '+css,()=>assert.ok(inspectCss('surface.css',css,surface).length));
test('surface CSS valid scope passes',()=>assert.deepEqual(inspectCss('bo.css',':where(html[data-bo-ui-authority="v25"]) .x {color:red}','BO'),[]));
function special(x) {
 x.entry.profile='FOUNDER_APPROVED_SPECIAL';x.entry.approval='approved-new';x.entry.files=[x.file];x.put(x.file,'export default function Page(){return <main><h1>Special</h1></main>}');
 const a={id:'approved-new',status:'approved',approvedBy:'Founder',reference:'https://vmtct97.atlassian.net/browse/PAP-1085?focusedCommentId=12345',approvedAt:'2026-10-27T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z',surface:'BO',key:'new',route:'/bo/new',owner:'Owner',justification:'Special workflow',designAuthority:'Approved alternative',fallback:'Return to TDD on expiry',permissions:['existing.permission'],files:[x.file],tests:{security:[x.testFile],authorization:[x.testFile],accessibility:[x.testFile],responsive:[x.testFile]}};
 x.manifest.approvals=[a];return a;
}
test('approved special gets alternative tests without TDD tabs',async t=>{const x=setup(t);special(x);const r=await x.check();assert.deepEqual(r.errors,[]);assert.deepEqual(r.tests,[x.testFile]);});
for(const [label,mutate] of [['wildcard route',a=>a.route='/bo/*'],['wildcard file',a=>a.files=['app/**']],['expired',a=>a.expiresAt='2026-10-28T00:00:00Z'],['revoked',a=>a.status='revoked'],['developer approved',a=>a.approvedBy='Developer'],['missing Founder record',a=>a.reference='PAP-1085'],['wrong surface',a=>a.surface='HO'],['wrong route',a=>a.route='/bo/other'],['missing alternative a11y',a=>a.tests.accessibility=[]],['file traversal',a=>a.files=['../escape.tsx']]]) test('special rejects '+label,async t=>{const x=setup(t),a=special(x);mutate(a);assert.ok((await x.check()).errors.length);});
test('special missing approval rejects',()=>assert.ok(validateSpecial({approval:'missing'},[],[],now).length));
test('special out-of-fence dependency rejects',async t=>{const x=setup(t);special(x);x.put(x.file,"import './other'; export default function Page(){return <main/>}");x.put('app/bo/new/other.tsx','export const Outside=()=> <p/>');assert.match((await x.check()).errors.join(),/outside admission fence/);});
test('authority dependency impacts admitted modules; unrelated file does not',async t=>{const x=setup(t);x.m.detail.businessTabs[0].id='overview';assert.deepEqual((await x.check(['app/tos/hotfix.tsx'])).errors,[]);assert.ok((await x.check(['app/components/workspace-renderer/Table.tsx'])).errors.length);});
test('candidate cannot authorize its own special approval',async t=>{const x=setup(t);special(x);const r=await verify(x.root,{baseline:x.baseline,manifest:x.manifest,changed:[x.file],now});assert.match(r.errors.join(),/Founder approval/);});
test('fake registry method cannot replace canonical TddRegistry',async t=>{const x=setup(t);x.put(x.schemaFile,'const registry={register:x=>x};export const schema=registry.register({});');assert.match((await x.check()).errors.join(),/TddRegistry.register/);});
test('schema on unrelated JSX attribute cannot replace view binding',async t=>{const x=setup(t);x.put(x.file,`import {schema} from './schema'; import {TddRenderer} from '@/app/components/workspace-renderer/Renderer'; export default function Page(){return <TddRenderer data-schema={schema} view={other}/>}`);assert.match((await x.check()).errors.join(),/binding required/);});
test('new shared source path requires owner reconciliation',async t=>{const x=setup(t);assert.match((await x.check(['app/components/workspace-renderer/NewShell.tsx'])).errors.join(),/owner reconciliation/);});
test('changed shell CSS outside authority fails; unrelated TOS CSS and untouched legacy rules pass',async()=>{const {inspectForeignCss}=await import('./verify-tdd-authority.mjs');assert.ok(inspectForeignCss('app/globals.css','.detail-hero{width:1px}','.detail-hero{width:500px!important}').length);assert.deepEqual(inspectForeignCss('app/globals.css','.detail-hero{width:1px}','.detail-hero{width:1px}.tos-card{padding:3px}'),[]);});

test('special stylesheet cannot leak across surfaces',async t=>{const x=setup(t),a=special(x),css='app/bo/new/special.css';x.entry.files.push(css);a.files=[...x.entry.files];x.put(css,'.global {color:red}');assert.match((await x.check([css])).errors.join(),/unscoped CSS/);});
test('JavaScript page cannot evade route admission',async t=>{const x=setup(t);x.put('app/ho/hidden/page.jsx','export default function Hidden(){return <main/>}');assert.match((await x.check()).errors.join(),/hidden.*requires explicit/);});

test('special malformed owner or permissions rejects',async t=>{const x=setup(t),a=special(x);a.permissions=[null];a.owner={name:'invented'};assert.match((await x.check()).errors.join(),/incomplete special profile/);});
test('duplicate approval identity cannot hide revocation',async t=>{const x=setup(t),a=special(x);x.manifest.approvals.push({...a,status:'revoked'});assert.match((await x.check()).errors.join(),/ambiguous Founder approval/);});

/** PAP-1134: real SurfaceWorkspace adapter admission cannot be satisfied by a fake direct renderer. */
function hoWorkspace(t) {
  const x=setup(t,'HO');
  const moduleRoot='app/ho/new';
  const bindingFile=moduleRoot+'/StaffTdd.tsx';
  const helper=`import {SurfaceWorkspace} from '@/app/components/workspace-adapters/SurfaceWorkspace';
import {createHoTddAdapter} from '@/lib/workspace-adapters';
import {TddRegistry} from '@/lib/workspace-schema';
import {staffDefinition,staffProvider} from './schema';
export function StaffTdd(){const ready={adapter:{},navigation:{}};const connection=createHoTddAdapter({registry:new TddRegistry(),definition:staffDefinition,provider:staffProvider},new AbortController().signal);return <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation}/>}`;
  x.put(x.file,"import {StaffTdd} from './StaffTdd';export default function Page(){return <StaffTdd/>}");
  x.put(bindingFile,helper);
  x.put(x.schemaFile,'import {TddRegistry} from "@/lib/workspace-schema";const registry=new TddRegistry();export const staffDefinition={};export const staffProvider={};export const schema=registry.register({...staffDefinition});');
  x.put('lib/workspace-schema/index.ts','export class TddRegistry {}');
  x.put('lib/workspace-adapters/index.ts','export const createHoTddAdapter=()=>null;');
  x.put('app/components/workspace-adapters/SurfaceWorkspace.tsx','export function SurfaceWorkspace(){return null}');
  x.entry.binding={kind:'SURFACE_WORKSPACE_ADAPTER',file:bindingFile};
  x.entry.files=[x.file,x.schemaFile,bindingFile];
  x.baseline.sourceFiles.push('lib/workspace-adapters/index.ts');
  return {...x,bindingFile,helper};
}
/** PAP-982: BO receives the same strict proof, plus a concrete selected Center. */
function boWorkspace(t) {
  const x=setup(t,'BO');
  const bindingFile='app/bo/new/SelfDirectoryTdd.tsx';
  const helper=`import {SurfaceWorkspace} from '@/app/components/workspace-adapters/SurfaceWorkspace';
import {createBoTddAdapter} from '@/lib/workspace-adapters';
import {TddRegistry} from '@/lib/workspace-schema';
import {directoryDefinition,directoryProvider} from './schema';
export function SelfDirectoryTdd(){const ready={adapter:{},navigation:{}};const selected='center-from-authorized-bootstrap';
const connection=createBoTddAdapter({registry:new TddRegistry(),definition:directoryDefinition,provider:directoryProvider,centerId:selected},new AbortController().signal);
return <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation}/>}`;
  x.put(x.file,"import {SelfDirectoryTdd} from './SelfDirectoryTdd';export default function Page(){return <SelfDirectoryTdd/>}");
  x.put(bindingFile,helper);
  x.put(x.schemaFile,'import {TddRegistry} from "@/lib/workspace-schema";const registry=new TddRegistry();export const directoryDefinition={};export const directoryProvider={};export const schema=registry.register({...directoryDefinition});');
  x.put('lib/workspace-schema/index.ts','export class TddRegistry {}');
  x.put('lib/workspace-adapters/index.ts','export const createBoTddAdapter=()=>null;');
  x.put('app/components/workspace-adapters/SurfaceWorkspace.tsx','export function SurfaceWorkspace(){return null}');
  x.entry.binding={kind:'SURFACE_WORKSPACE_ADAPTER',file:bindingFile};x.entry.files=[x.file,x.schemaFile,bindingFile];
  x.baseline.sourceFiles.push('lib/workspace-adapters/index.ts');
  return {...x,bindingFile,helper};
}
test('PAP-982 registered BO adapter-backed SurfaceWorkspace must have real Center-bound binding',async t=>{
  const x=boWorkspace(t);assert.deepEqual((await x.check()).errors,[]);
  x.put(x.bindingFile,x.helper.replace(',centerId:selected',''));
  assert.match((await x.check()).errors.join(),/binding required/);
});
test('PAP-982 BO source rejects fake adapter, fake session schema and fake renderer',async t=>{
  const x=boWorkspace(t);
  for(const fake of [x.helper.replace('createBoTddAdapter({','fakeAdapter({'),
    x.helper.replace('provider:directoryProvider','provider:fakeProvider'),
    x.helper.replace('@/app/components/workspace-adapters/SurfaceWorkspace','./FakeWorkspace')]){
    x.put(x.bindingFile,fake);
    assert.match((await x.check()).errors.join(),/binding required/);
  }
});
test('PAP-1134 real HO adapter-backed SurfaceWorkspace passes registered canonical gate',async t=>{
  const x=hoWorkspace(t);
  const verdict=await x.check();
  assert.deepEqual(verdict.errors,[]);
  assert.ok(verdict.tests.includes(x.testFile));
});
test('PAP-1134 noncanonical stub SurfaceWorkspace fails',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper.replace("@/app/components/workspace-adapters/SurfaceWorkspace","./FakeWorkspace"));
  x.put('app/ho/new/FakeWorkspace.tsx','export function SurfaceWorkspace(){return null}');
  x.entry.files.push('app/ho/new/FakeWorkspace.tsx');
  assert.match((await x.check()).errors.join(),/binding required/);
});
test('PAP-1134 unconnected adapter or schema definition fails',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper.replace('definition:staffDefinition','definition:unrelated'));
  assert.match((await x.check()).errors.join(),/binding required/);
});
test('PAP-1134 fake renderer view without canonical adapter cannot pass',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper.replace('createHoTddAdapter({','fakeAdapter({'));
  assert.match((await x.check()).errors.join(),/binding required/);
});
test('PAP-1134 module-local helper not in owner fence fails',async t=>{
  const x=hoWorkspace(t);
  x.put(x.file,"import {StaffTdd} from './StaffTdd';import './shell';export default function Page(){return <StaffTdd/>}");
  x.put('app/ho/new/shell.tsx','export const Legacy=()=> <div className="detail-hero"/>');
  assert.match((await x.check()).errors.join(),/outside admission fence/);
  x.entry.files.push('app/ho/new/shell.tsx');
  assert.match((await x.check()).errors.join(),/reserved shell/);
});
test('PAP-1134 new external dependency must be owned or fenced',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/ho-rogue';");
  x.put('lib/ho-rogue.ts','export const unknown=1');
  assert.match((await x.check(['lib/ho-rogue.ts'])).errors.join(),/outside admission fence/);
});

test('PAP-1134 exact external owner reference allows independent HO infrastructure under inspection',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/ho-owned';");
  x.put('lib/ho-owned.ts','export const scope="HO"');
  x.entry.externalReferences=[{file:'lib/ho-owned.ts',owner:'PAP-990'}];
  assert.deepEqual((await x.check(['lib/ho-owned.ts'])).errors,[]);
  x.put('lib/ho-owned.ts','export function bad(){document.body.innerHTML="<div/>"}');
  assert.match((await x.check(['lib/ho-owned.ts'])).errors.join(),/opaque HTML assignment/);
  x.entry.externalReferences=[{file:'lib/ho-owned.ts',owner:'No owner'}];
  assert.match((await x.check(['lib/ho-owned.ts'])).errors.join(),/invalid external owner reference/);
});

test('PAP-1138: independent grandfathered BO detail + new URL helper do not inherit HO Staff shell gate',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/ho-host';");
  x.put('lib/ho-host.ts',"import '@/app/bo/components/registration/BoFullDetail'; export const host='existing';");
  const legacy='app/bo/components/registration/BoFullDetail.tsx';
  const url='lib/bo-subscription-detail-url.ts';
  x.put(legacy,"import '@/lib/bo-subscription-detail-url';export const Legacy=()=> <div className={classes['detail-hero']}/>;");
  x.put(url,'export const parseUrl = (url) => new URL(url);');
  // Preexisting HO host already imported this BO legacy tree; only BO owner changes.
  assert.deepEqual((await x.check([legacy,url])).errors,[]);
  // A changed protected shared renderer must still trigger G0 schema validation.
  x.m.detail.businessTabs[0].id='overview';
  assert.match((await x.check(['app/components/workspace-renderer/Table.tsx'])).errors.join(),/reserved|invalid|overview|business/i);
});
test('PAP-1138: direct unowned imported helper remains gated',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/bo-subscription-detail-url';");
  x.put('lib/bo-subscription-detail-url.ts','export const unrelated=1');
  assert.match((await x.check(['lib/bo-subscription-detail-url.ts'])).errors.join(),/outside admission fence/);
});
test('PAP-1138: indirect changed sensitive auth dependency still requires exact owner',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/ho-host';");
  x.put('lib/ho-host.ts',"import '@/lib/ho-auth';export const host='existing';");
  x.put('lib/ho-auth.tsx','export const authorized=true');
  assert.match((await x.check(['lib/ho-auth.tsx'])).errors.join(),/outside admission fence/);
  x.entry.externalReferences=[{file:'lib/ho-auth.tsx',owner:'PAP-990'}];
  assert.deepEqual((await x.check(['lib/ho-auth.tsx'])).errors,[]);
  x.put('lib/ho-auth.tsx','export const Unsafe=()=> <div className="detail-hero"/>;');
  assert.match((await x.check(['lib/ho-auth.tsx'])).errors.join(),/reserved shell/);
});
test('PAP-1138: external owner reference rejects fabricated and wildcard paths',async t=>{
  const x=hoWorkspace(t);
  x.put(x.bindingFile,x.helper+"\nimport '@/lib/ho-host';");
  x.put('lib/ho-host.ts',"import '@/app/bo/components/registration/BoFullDetail'; export const host='existing';");
  x.put('app/bo/components/registration/BoFullDetail.tsx','export const legacy=1');
  x.entry.externalReferences=[{file:'app/bo/**',owner:'PAP-1102'}];
  assert.match((await x.check(['app/bo/components/registration/BoFullDetail.tsx'])).errors.join(),/invalid external owner reference/);
  x.entry.externalReferences=[{file:'lib/does-not-exist.ts',owner:'PAP-1102'}];
  assert.match((await x.check(['app/bo/components/registration/BoFullDetail.tsx'])).errors.join(),/invalid external owner reference/);
});
