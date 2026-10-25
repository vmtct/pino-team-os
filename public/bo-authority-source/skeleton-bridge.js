/* PAP-979: registration renderer + four read-only school data adapters.
 * No module mocks, other-module renderers, or authored styles.
 */
const requestedModule=new URLSearchParams(location.search).get('module');
const skeletonModule=Object.hasOwn(window.PinoSchoolRead.modules,requestedModule)?requestedModule:'students';
const school=window.PinoSchoolRead.modules[skeletonModule];
history.replaceState(null,'',skeletonModule==='students'?'/bo':'/bo?module='+encodeURIComponent(skeletonModule));
const registrationNav=renderNav;
renderNav=function(){registrationNav();for(const a of qa('a[href]',$('lab-nav')))a.classList.toggle('active',(new URL(a.href).searchParams.get('module')||'students')===skeletonModule);};
const registrationBind=bind;
bind=function(){registrationBind();$('collapse-all').onclick=()=>{for(const [group] of skeletonNavigation)state.collapsed.add(group);renderNav();};};
q('.topbar-root').href='/bo';q('#list-screen h1').textContent=school.label;q('.topbar-breadcrumb strong').textContent=school.label;document.title=school.label+' · PINO BO';
FIELDS.splice(0,FIELDS.length,...school.fields);for(const key of Object.keys(FIELD_MAP))delete FIELD_MAP[key];Object.assign(FIELD_MAP,Object.fromEntries(FIELDS.map(f=>[f.key,f])));
DEFAULT_COLUMNS.splice(0,DEFAULT_COLUMNS.length,...FIELDS.map(f=>f.key));v22.order=FIELDS.map(f=>f.key);v22.visible=new Set(DEFAULT_COLUMNS);
rows.splice(0);V24_EVENTS.splice(0);let loadState='loading';
const registrationNewRule=newRule;newRule=function(field=FIELDS[0].key){return registrationNewRule(field);};
for(const button of qa('[data-view]'))if(button.dataset.view!=='all'){button.disabled=true;button.title='Chưa kết nối nghiệp vụ';}
const registrationTable=renderTable,registrationDrawer=renderDrawer,registrationDetail=renderDetail;
applyCell=()=>false;openEditor=()=>{};createDraft=()=>null;
renderTable=function(){
 registrationTable();$('add-record').disabled=true;if(loadState==='ready')return;
 const cell=document.createElement('td');cell.colSpan=FIELDS.length+1;const message=document.createElement('div');message.className='empty-table';message.textContent=loadState==='loading'?'Đang tải dữ liệu…':loadState;message.setAttribute('role',loadState==='loading'?'status':'alert');cell.append(message);const tr=document.createElement('tr');tr.append(cell);$('table-body').replaceChildren(tr);
};
renderDrawer=function(){registrationDrawer();if($('drawer-name')){$('drawer-name').disabled=true;$('drawer-name').title='Chỉ đọc';}const hint=q('.quick-type');if(hint)hint.textContent=school.label+' · READ ONLY';const heading=q('.property-section h3');if(heading)heading.textContent='Properties · chỉ đọc';};
v24AdvancedContent=()=>'<section class="v24-intro"><div><h3>Chuyên Sâu</h3><p>Chưa kết nối nghiệp vụ nâng cao.</p></div><span class="v24-demo-label">CHƯA KẾT NỐI</span></section>';
const registrationHistory=v24HistoryContent;v24HistoryContent=function(rec){return registrationHistory(rec).replace('MOCK DATA','CHƯA KẾT NỐI');};
v24AuditList=()=>'<div class="v24-audit-empty">Lịch sử chưa kết nối. Không có sự kiện được tải.</div>';
renderDetail=function(){registrationDetail();const snapshot=q('.v24-eyebrow');if(snapshot)snapshot.textContent=school.label+' · '+(v24CurrentRec()?.id||'');const capability=q('.v24-demo-label');if(state.tab==='Detail'&&capability)capability.textContent='READ ONLY';const note=q('.v24-capability-note');if(note)note.textContent='Chỉ đọc · chỉnh sửa chưa kết nối backend.';};
q('table caption').textContent=school.label+' · dữ liệu thật, chỉ đọc';
q('.detail-hero .eyebrow').textContent=school.label+' / FULL DETAIL';
window.PinoSchoolRead.load(skeletonModule,window.fetch.bind(window)).then(result=>{rows.splice(0,rows.length,...result);loadState='ready';}).catch(error=>{rows.splice(0);loadState=error.message;}).finally(()=>renderTable());
