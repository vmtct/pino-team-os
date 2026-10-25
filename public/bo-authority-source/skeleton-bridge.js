/* PAP-979: behavior/data seam in the Hồ sơ đăng ký closure before bootstrap.
 * Every shared renderer and every presentation class comes from that module.
 * No other module is a styling reference. No styles are authored here.
 */
const skeletonModule=new URLSearchParams(location.search).get('module')||'registration';
const skeletonModules=Object.fromEntries(skeletonNavigation.flatMap(([,items])=>items.map(item=>[new URL(item.href,location.href).searchParams.get('module')||'registration',item.label])));
const skeletonLabel=skeletonModules[skeletonModule]||'Hồ sơ đăng ký';
const registrationNav=renderNav;
renderNav=function(){
 registrationNav();
 for(const a of qa('a[href]', $('lab-nav'))){
  const url=new URL(a.href);const key=url.searchParams.get('module')||'registration';
  a.href='./playground.html'+(key==='registration'?'':'?module='+encodeURIComponent(key));a.classList.toggle('active',key===skeletonModule);
 }
};
const registrationBind=bind;
bind=function(){registrationBind();$('collapse-all').onclick=()=>{for(const [group] of skeletonNavigation)state.collapsed.add(group);renderNav();};};
q('.topbar-root').href='./playground.html';
if(skeletonModule!=='registration'){
 q('#list-screen h1').textContent=skeletonLabel;q('.topbar-breadcrumb strong').textContent=skeletonLabel;
 document.title=skeletonLabel+' · PINO BO';
}
if(skeletonModule==='students'){
 const studentFields=[
  {key:'name',label:'Học viên',type:'text',icon:'Aa',w:235,readonly:true},
  {key:'id',label:'ID',type:'id',icon:'#',w:145,readonly:true},
  {key:'paths',label:'Path',type:'text',icon:'↗',w:172,readonly:true},
  {key:'birthYear',label:'Năm sinh',type:'number',icon:'#',w:113,readonly:true},
  {key:'status',label:'Trạng thái hồ sơ',type:'select',icon:'▣',w:135,readonly:true},
  {key:'houseMember',label:'House Member',type:'boolean',icon:'☑',w:120,readonly:true}
 ];
 FIELDS.splice(0,FIELDS.length,...studentFields);for(const key of Object.keys(FIELD_MAP))delete FIELD_MAP[key];Object.assign(FIELD_MAP,Object.fromEntries(FIELDS.map(f=>[f.key,f])));
 DEFAULT_COLUMNS.splice(0,DEFAULT_COLUMNS.length,...FIELDS.map(f=>f.key));v22.order=FIELDS.map(f=>f.key);v22.visible=new Set(DEFAULT_COLUMNS);
 rows.splice(0);V24_EVENTS.splice(0);let studentState='loading';
 const registrationNewRule=newRule;newRule=function(field=FIELDS[0].key){return registrationNewRule(field);};
 for(const button of qa('[data-view]'))if(button.dataset.view!=='all'){button.disabled=true;button.title='Chưa kết nối nghiệp vụ';}
 const registrationTable=renderTable,registrationDrawer=renderDrawer,registrationDetail=renderDetail;
 applyCell=()=>false;openEditor=()=>toast('Chỉ đọc · chưa kết nối chỉnh sửa');createDraft=()=>null;
 renderTable=function(){
  registrationTable();$('add-record').disabled=true;
  if(studentState==='ready')return;
  const cell=document.createElement('td');cell.colSpan=FIELDS.length+1;const message=document.createElement('div');message.className='empty-table';message.textContent=studentState==='loading'?'Đang tải học viên…':studentState;message.setAttribute('role',studentState==='loading'?'status':'alert');cell.append(message);const tr=document.createElement('tr');tr.append(cell);$('table-body').replaceChildren(tr);
 };
 renderDrawer=function(){registrationDrawer();if($('drawer-name')){$('drawer-name').disabled=true;$('drawer-name').title='Chỉ đọc';}const hint=q('.quick-type');if(hint)hint.textContent='HỌC VIÊN · READ ONLY';const heading=q('.property-section h3');if(heading)heading.textContent='Properties · chỉ đọc';};
 v24AdvancedContent=()=>'<section class="v24-intro"><div><h3>Chuyên Sâu</h3><p>UI skeleton · chưa kết nối backend.</p></div><span class="v24-demo-label">CHƯA KẾT NỐI</span></section>';
 const registrationHistory=v24HistoryContent;
 v24HistoryContent=function(rec){return registrationHistory(rec).replace('MOCK DATA','CHƯA KẾT NỐI');};
 v24AuditList=()=>'<div class="v24-audit-empty">Lịch sử chưa kết nối. Không có sự kiện được tải.</div>';
 renderDetail=function(){registrationDetail();const snapshot=q('.v24-eyebrow');if(snapshot)snapshot.textContent='HỌC VIÊN · '+(v24CurrentRec()?.id||'');const capability=q('.v24-demo-label');if(state.tab==='Detail'&&capability)capability.textContent='READ ONLY';const note=q('.v24-capability-note');if(note)note.textContent='Chỉ đọc · UI skeleton. Chỉnh sửa chưa kết nối backend.';};
 q('table caption').textContent='Học viên · dữ liệu thật, chỉ đọc';
 // Only this table reads business data. Pagination retains canonical IDs and
 // fails closed on denial, malformed responses or non-progressing cursors.
 (async()=>{
  const collected=[],seen=new Set();let cursor=null;
  for(let page=0;;page++){
   if(page>=100)throw Error('Danh bạ quá lớn. Chưa tải dữ liệu; hãy tải lại.');
   const response=await fetch('/api/bo/learners?limit=100'+(cursor?'&beforeStudentId='+encodeURIComponent(cursor):''),{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
   if(!response.ok)throw Error(response.status===401?'Phiên đăng nhập đã hết hạn.':response.status===403?'Bạn không có quyền đọc học viên.':response.status===409?'Dữ liệu đã thay đổi. Hãy tải lại.':'Không thể tải học viên. Hãy tải lại.');
   const body=await response.json();if(!Array.isArray(body.data))throw Error('Phản hồi danh bạ không hợp lệ.');
   for(const s of body.data){
    if(typeof s.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)||seen.has(s.id)||typeof s.displayName!=='string'||typeof s.status!=='string'||!Array.isArray(s.activePaths)||s.activePaths.some(p=>typeof p.displayName!=='string'))throw Error('Không xác nhận được dữ liệu danh bạ.');
    seen.add(s.id);collected.push({id:s.id,name:s.displayName,paths:s.activePaths.map(p=>p.displayName).join(', '),birthYear:s.birthYear,status:s.status,houseMember:s.houseMember});
   }
   if(body.data.length<100)break;cursor=body.data.at(-1).id;
  }
  rows.splice(0,rows.length,...collected);studentState='ready';
 })().catch(error=>{rows.splice(0);studentState=error.message;}).finally(()=>renderTable());
}
