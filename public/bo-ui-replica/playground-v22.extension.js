/* PAP-884 V2.2 — authoritative UI proposal: Notion-inspired settings, grouping, views and undo.
   Runs in the playground IIFE, using the same mock rows and typed editors. */
const v22={
 order:FIELDS.map(f=>f.key),
 visible:new Set(DEFAULT_COLUMNS),
 groupField:null,collapsed:new Set(),hiddenGroups:new Set(),hideEmpty:true,
 savedViews:[],activeView:null,settingsScreen:"home",settingQuery:"",
 undo:[],redo:[],restoring:false,focusUndo:false,editSerial:0
};
const vclone = x=>JSON.parse(JSON.stringify(x));
function vSnapshot(){
 return {rows:vclone(rows),nextId,table:{view:state.view,search:state.search,rules:vclone(state.rules),
 logic:state.logic,sort:state.sort,desc:state.desc,page:state.page,pageSize:state.pageSize},
 order:[...v22.order],visible:[...v22.visible],groupField:v22.groupField,
 collapsed:[...v22.collapsed],hiddenGroups:[...v22.hiddenGroups],hideEmpty:v22.hideEmpty,
 savedViews:vclone(v22.savedViews),activeView:v22.activeView,tagColors:{...TAG_COLOR}};
}
function recordUndo(label){
 if(v22.restoring)return;
 const current=vSnapshot(),last=v22.undo[v22.undo.length-1];
 if(last&&last.label===label&&JSON.stringify(last.snapshot)===JSON.stringify(current))return;
 v22.undo.push({label,snapshot:current});if(v22.undo.length>80)v22.undo.shift();
 v22.redo.length=0;updateUndoButton();
}
function restoreSnapshot(snapshot){
 v22.restoring=true;
 try{
  rows.splice(0,rows.length,...vclone(snapshot.rows));nextId=snapshot.nextId;
  Object.assign(state,vclone(snapshot.table));
  v22.order=[...snapshot.order];v22.visible=new Set(snapshot.visible);
  v22.groupField=snapshot.groupField;v22.collapsed=new Set(snapshot.collapsed);
  v22.hiddenGroups=new Set(snapshot.hiddenGroups);v22.hideEmpty=snapshot.hideEmpty;
  v22.savedViews=vclone(snapshot.savedViews);v22.activeView=snapshot.activeView;
  for(const key of Object.keys(TAG_COLOR))delete TAG_COLOR[key];Object.assign(TAG_COLOR,snapshot.tagColors||{});
  $("search").value=state.search;renderRules();renderTable();if(v22.settingsOpen)renderSettings();
  if($("drawer").classList.contains("open")){
   const exists=state.draft||rows.some(r=>r.id===state.drawer);
   if(exists)renderDrawer();else closeDrawer();
  }
 }finally{v22.restoring=false;updateUndoButton();}
}
function undoAction(){
 if(!v22.undo.length){toast("Không còn thao tác để hoàn tác");return;}
 v22.redo.push({label:"redo",snapshot:vSnapshot()});
 const last=v22.undo.pop();restoreSnapshot(last.snapshot);toast("↶ Hoàn tác: "+last.label);
}
function redoAction(){
 if(!v22.redo.length){toast("Không còn thao tác để làm lại");return;}
 v22.undo.push({label:"redo",snapshot:vSnapshot()});
 const next=v22.redo.pop();restoreSnapshot(next.snapshot);toast("↷ Làm lại");
}
function updateUndoButton(){
 const u=$("undo-v22"),r=$("redo-v22");if(u)u.disabled=!v22.undo.length;if(r)r.disabled=!v22.redo.length;
}
function vGroupKey(record){
 if(!v22.groupField)return null;
 const raw=val(record,v22.groupField);
 return empty(raw)?"(Trống)":Array.isArray(raw)?raw.join(", ")||( "(Trống)"):typeof raw==="boolean"?(raw?"Có":"Không"):String(raw);
}
function vGroupCandidates(){
 const f=FIELD_MAP[v22.groupField];if(!f)return [];
 const values=filtered().map(vGroupKey);
 const known=f.type==="boolean"?["Có","Không"]:f.options||[];
 return [...new Set([...known,...values])].sort((a,b)=>String(a).localeCompare(String(b),"vi"));
}
function vGroupByDisplay(){
 if(!v22.groupField)return;
 const tbody=$("table-body"), trs=qa("tr[data-record]",tbody);
 const current=filtered();const offset=(state.page-1)*state.pageSize;
 const index=new Map(trs.map(tr=>[tr.dataset.record,tr]));
 const onPage=current.slice(offset,offset+state.pageSize);
 const counts=new Map();
 for(const row of current){const key=vGroupKey(row);counts.set(key,(counts.get(key)||0)+1);}
 let groups=vGroupCandidates();
 if(v22.hideEmpty)groups=groups.filter(k=>(counts.get(k)||0)>0);
 const cols=visibleColumns().length+1,frag=document.createDocumentFragment();
 for(const key of groups){
  if(v22.hiddenGroups.has(key))continue;
  const groupRows=onPage.filter(row=>vGroupKey(row)===key);
  if(!groupRows.length&&v22.hideEmpty)continue;
  const tr=document.createElement("tr");tr.className="group-heading-row";
  tr.innerHTML='<td colspan="'+cols+'"><button type="button" class="group-toggle" data-group-toggle="'+esc(key)+'" aria-expanded="'+!v22.collapsed.has(key)+'"><span class="group-caret">'+(v22.collapsed.has(key)?"▸":"▾")+'</span><span class="group-pill">'+esc(key)+'</span><small>'+Number(counts.get(key)||0)+' bản ghi</small></button></td>';
  frag.appendChild(tr);
  if(!v22.collapsed.has(key))for(const row of groupRows){const el=index.get(row.id);if(el)frag.appendChild(el);}
 }
 tbody.replaceChildren(frag);
 qa("[data-group-toggle]",tbody).forEach(button=>button.onclick=()=>{
  const key=button.dataset.groupToggle;if(v22.collapsed.has(key))v22.collapsed.delete(key);else v22.collapsed.add(key);
  renderTable();
 });
}
const vOrigVisibleColumns=visibleColumns;
visibleColumns=function(){return v22.order.filter(k=>v22.visible.has(k)).map(k=>FIELD_MAP[k]);};
const vOrigRenderTable=renderTable;
renderTable=function(){
 vOrigRenderTable();
 const colButton=$("visible-columns").querySelector("span");if(colButton)colButton.textContent="Hiển thị thuộc tính";
 vGroupByDisplay();
 vRenderSavedTabs();
 updateUndoButton();
};
function vRenderSavedTabs(){
 const parent=q(".tabs-left");if(!parent)return;
 qa(".saved-tab",parent).forEach(node=>node.remove());
 for(const item of v22.savedViews){
  const btn=document.createElement("button");btn.type="button";btn.className="view-tab saved-tab"+(v22.activeView===item.id?" active":"");btn.dataset.saved=item.id;
  btn.textContent="▤  "+item.name;
  btn.onclick=()=>applySavedView(item.id);
  parent.append(btn);
 }
 if(v22.activeView)qa(".view-tab:not(.saved-tab)",parent).forEach(el=>el.classList.remove("active"));
}
function vCurrentView(){
 return {rules:vclone(state.rules),logic:state.logic,sort:state.sort,desc:state.desc,view:state.view,
  search:state.search,order:[...v22.order],visible:[...v22.visible],groupField:v22.groupField,
  hideEmpty:v22.hideEmpty,hiddenGroups:[...v22.hiddenGroups]};
}
function applySavedView(id){
 const item=v22.savedViews.find(x=>x.id===id);if(!item)return;
 recordUndo("Chuyển Quick View");
 const v=item.config;state.rules=vclone(v.rules);state.logic=v.logic;state.sort=v.sort;state.desc=v.desc;
 state.view=v.view;state.search=v.search;state.page=1;$("search").value=state.search;
 v22.order=[...v.order];v22.visible=new Set(v.visible);v22.groupField=v.groupField;
 v22.hideEmpty=v.hideEmpty;v22.hiddenGroups=new Set(v.hiddenGroups);
 v22.collapsed.clear();v22.activeView=id;renderRules();renderTable();toast("View: "+item.name);
}
function vSettingsToggle(open,screen="home"){
 v22.settingsOpen=open;v22.settingsScreen=screen;
 $("settings-panel").classList.toggle("open",open);
 $("settings-panel").setAttribute("aria-hidden",String(!open));
 $("settings-scrim").classList.toggle("visible",open);
 if(open){renderSettings();$("settings-close").focus();}
}
function vOpenSettings(screen){vSettingsToggle(true,screen);}
function vSettingsTitle(){
 return {home:"Cài đặt bảng",properties:"Hiển thị thuộc tính",group:"Nhóm",views:"Quick Views"}[v22.settingsScreen];
}
function renderSettings(){
 const screen=v22.settingsScreen;$("settings-title").textContent=vSettingsTitle();
 $("settings-back").style.visibility=screen==="home"?"hidden":"visible";
 if(screen==="home")return renderSettingsHome();
 if(screen==="properties")return renderPropertySettings();
 if(screen==="group")return renderGroupSettings();
 return renderSavedSettings();
}
function renderSettingsHome(){
 $("settings-content").innerHTML='<div class="settings-menu">'+[
  ["properties","◫","Hiển thị thuộc tính","Tìm, ẩn/hiện, kéo thả, đổi thứ tự cột"],
  ["group","▦","Nhóm","Nhóm theo field, ẩn/hiện và thu gọn"],
  ["views","▤","Quick Views","Lưu filter, sort, group và layout"]
 ].map(a=>'<button type="button" data-settings="'+a[0]+'"><span class="settings-menu-icon">'+a[1]+'</span><span><b>'+a[2]+'</b><small>'+a[3]+'</small></span><i>›</i></button>').join("")+'</div><div class="settings-hint">Tip: Ctrl+Z hoàn tác; Ctrl+Shift+Z làm lại mọi thay đổi mock.</div>';
 qa("[data-settings]",$("settings-content")).forEach(b=>b.onclick=()=>{v22.settingsScreen=b.dataset.settings;renderSettings()});
}
function reorderColumn(source,target){
 if(source===target||source==="name"||target==="name")return;
 recordUndo("Sắp xếp cột");
 const next=v22.order.filter(x=>x!==source),index=next.indexOf(target);
 next.splice(index,0,source);v22.order=next;renderTable();renderSettings();
}
function renderPropertySettings(){
 const search=v22.settingQuery;
 const group=(shown,title)=>{
  const keys=v22.order.filter(key=>v22.visible.has(key)===shown).filter(key=>norm(FIELD_MAP[key].label).includes(norm(search)));
  return '<div class="settings-section-heading"><strong>'+title+'</strong><button type="button" data-bulk="'+(shown?"hide":"show")+'">'+(shown?"Ẩn tất cả":"Hiện tất cả")+'</button></div>'+
  '<div class="property-list">'+keys.map(key=>{
   const f=FIELD_MAP[key],locked=key==="name",idx=v22.order.indexOf(key);
   return '<div class="property-item" draggable="'+(!locked)+'" data-property="'+key+'"><span class="drag-grip" title="Kéo đổi thứ tự">⠿</span>'+
   '<span class="property-kind">'+f.icon+'</span><span class="property-text">'+esc(f.label)+'</span>'+
   '<button type="button" class="col-move" data-move="'+key+'" data-step="-1" title="Lên">↑</button>'+
   '<button type="button" class="col-move" data-move="'+key+'" data-step="1" title="Xuống">↓</button>'+
   '<button type="button" class="eye-toggle" data-eye="'+key+'" '+(locked?"disabled":"")+' title="'+(shown?"Ẩn":"Hiện")+'">'+(shown?"◉":"◉̸")+'</button></div>';
  }).join("")+(keys.length?"":'<p class="settings-empty">Không có thuộc tính phù hợp</p>')+'</div>';
 };
 $("settings-content").innerHTML='<label class="settings-search">⌕ <input id="property-query" placeholder="Tìm thuộc tính..." value="'+esc(search)+'" autocomplete="off"></label>'+
  group(true,"Hiện trong bảng")+group(false,"Ẩn trong bảng")+'<p class="settings-hint">Kéo thả bằng dấu ⠿ hoặc dùng ↑ ↓ để đổi thứ tự. Tên bản ghi luôn được giữ.</p>';
 $("property-query").oninput=e=>{const start=e.target.selectionStart;v22.settingQuery=e.target.value;renderSettings();$("property-query").focus();$("property-query").setSelectionRange(start,start)};
 qa("[data-eye]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const key=b.dataset.eye;if(key==="name")return;recordUndo("Ẩn/hiện cột");
  if(v22.visible.has(key))v22.visible.delete(key);else v22.visible.add(key);
  v22.activeView=null;renderTable();renderSettings();
 });
 qa("[data-bulk]",$("settings-content")).forEach(b=>b.onclick=()=>{
  recordUndo("Hiện/ẩn tất cả cột");v22.visible=b.dataset.bulk==="show"?new Set(v22.order):new Set(["name"]);
  v22.activeView=null;renderTable();renderSettings();
 });
 qa("[data-move]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const from=v22.order.indexOf(b.dataset.move),to=from+Number(b.dataset.step);
  if(to<1||to>=v22.order.length)return;
  recordUndo("Đổi thứ tự cột");
  [v22.order[from],v22.order[to]]=[v22.order[to],v22.order[from]];
  v22.activeView=null;renderTable();renderSettings();
 });
 qa("[data-property]",$("settings-content")).forEach(item=>{
  item.addEventListener("dragstart",event=>{
   if(item.dataset.property==="name"){event.preventDefault();return;}
   event.dataTransfer.setData("text/plain",item.dataset.property);
   event.dataTransfer.effectAllowed="move";
  });
  item.addEventListener("dragover",event=>{event.preventDefault();item.classList.add("drag-hover")});
  item.addEventListener("dragleave",()=>item.classList.remove("drag-hover"));
  item.addEventListener("drop",event=>{
   event.preventDefault();const src=event.dataTransfer.getData("text/plain");
   item.classList.remove("drag-hover");if(v22.order.includes(src))reorderColumn(src,item.dataset.property);
  });
 });
}
function vGroupsWithCount(){
 const counts=new Map();for(const row of filtered()){const key=vGroupKey(row);counts.set(key,(counts.get(key)||0)+1);}
 let values=vGroupCandidates();
 if(v22.hideEmpty)values=values.filter(v=>(counts.get(v)||0)>0);
 return values.map(key=>({key,count:counts.get(key)||0}));
}
function renderGroupSettings(){
 const eligible=FIELDS.filter(f=>["select","relation","person","boolean","date","text","number"].includes(f.type));
 const groups=v22.groupField?vGroupsWithCount():[];
 $("settings-content").innerHTML='<div class="settings-line"><span>Nhóm theo</span><select id="group-field"><option value="">Không nhóm</option>'+eligible.map(f=>'<option value="'+f.key+'" '+(v22.groupField===f.key?"selected":"")+'>'+esc(f.label)+'</option>').join("")+'</select></div>'+
 '<label class="settings-line"><span>Ẩn nhóm trống</span><input type="checkbox" id="hide-empty" '+(v22.hideEmpty?"checked":"")+'></label>'+
 (v22.groupField?'<div class="settings-section-heading"><strong>Nhóm</strong><div><button type="button" id="group-hide-all">Ẩn tất cả</button><button type="button" id="group-show-all">Hiện tất cả</button></div></div>'+
 '<div class="settings-small-actions"><button type="button" id="group-collapse-all">Thu gọn tất cả</button><button type="button" id="group-expand-all">Mở rộng tất cả</button></div>'+
 groups.map(g=>'<div class="group-settings-item"><button type="button" data-collapse-key="'+esc(g.key)+'" title="Thu gọn/mở rộng">'+(v22.collapsed.has(g.key)?"▸":"▾")+'</button>'+
 '<span>'+esc(g.key)+' <small>('+g.count+')</small></span><button type="button" data-group-eye="'+esc(g.key)+'" title="Ẩn/hiện nhóm">'+(v22.hiddenGroups.has(g.key)?"◉̸":"◉")+'</button></div>').join("")+
 '<button type="button" id="remove-group" class="settings-danger">⌫ &nbsp; Xóa nhóm</button>':
 '<p class="settings-hint">Chọn một thuộc tính để hiển thị nhóm trong bảng. Có thể thu gọn từng nhóm.</p>');
 $("group-field").onchange=e=>{
  recordUndo("Thay đổi Group");v22.groupField=e.target.value||null;
  v22.collapsed.clear();v22.hiddenGroups.clear();v22.activeView=null;
  renderTable();renderSettings();
 };
 $("hide-empty").onchange=e=>{recordUndo("Ẩn nhóm trống");v22.hideEmpty=e.target.checked;renderTable();renderSettings()};
 const act=(selector,cb)=>{if($(selector))$(selector).onclick=cb;};
 act("group-hide-all",()=>{recordUndo("Ẩn tất cả nhóm");v22.hiddenGroups=new Set(groups.map(g=>g.key));renderTable();renderSettings()});
 act("group-show-all",()=>{recordUndo("Hiện tất cả nhóm");v22.hiddenGroups.clear();renderTable();renderSettings()});
 act("group-collapse-all",()=>{recordUndo("Thu gọn tất cả nhóm");v22.collapsed=new Set(groups.map(g=>g.key));renderTable();renderSettings()});
 act("group-expand-all",()=>{recordUndo("Mở rộng tất cả nhóm");v22.collapsed.clear();renderTable();renderSettings()});
 act("remove-group",()=>{recordUndo("Xóa Group");v22.groupField=null;v22.collapsed.clear();v22.hiddenGroups.clear();renderTable();renderSettings()});
 qa("[data-collapse-key]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const k=b.dataset.collapseKey;recordUndo("Thu gọn/mở rộng nhóm");
  if(v22.collapsed.has(k))v22.collapsed.delete(k);else v22.collapsed.add(k);
  renderTable();renderSettings();
 });
 qa("[data-group-eye]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const k=b.dataset.groupEye;recordUndo("Ẩn/hiện nhóm");
  if(v22.hiddenGroups.has(k))v22.hiddenGroups.delete(k);else v22.hiddenGroups.add(k);
  renderTable();renderSettings();
 });
}
function saveNamedView(name){
 const clean=name.trim().slice(0,38);if(!clean){toast("Cần nhập tên Quick View");return;}
 recordUndo("Lưu Quick View");
 const id="view-"+Date.now()+"-"+(v22.savedViews.length+1);
 v22.savedViews.push({id,name:clean,config:vCurrentView()});v22.activeView=id;
 renderTable();renderSettings();toast("Đã lưu view: "+clean);
}
function renderSavedSettings(){
 $("settings-content").innerHTML='<p class="settings-hint">Lưu cả Filter · Sort · Group · thứ tự/hiển thị cột vào một tab nhanh.</p>'+
 '<div class="save-view-form"><input type="text" id="new-view-name" maxlength="38" placeholder="Tên Quick View, ví dụ: P0"><button type="button" id="confirm-save-view">＋ Lưu view</button></div>'+
 '<div class="settings-section-heading"><strong>Views đã lưu ('+v22.savedViews.length+')</strong></div>'+
 (v22.savedViews.length?v22.savedViews.map(v=>'<div class="saved-view-row"><button type="button" data-load-view="'+v.id+'">▤ '+esc(v.name)+'</button>'+
 '<button type="button" data-rename-view="'+v.id+'" title="Đổi tên">✎</button><button type="button" data-delete-view="'+v.id+'" title="Xóa">×</button></div>').join(""):'<p class="settings-empty">Chưa lưu view nào.</p>')+
 '<p class="settings-hint">Các view mô phỏng được lưu trong bộ nhớ tab; tải lại trang sẽ reset.</p>';
 $("confirm-save-view").onclick=()=>saveNamedView($("new-view-name").value);
 $("new-view-name").onkeydown=e=>{if(e.key==="Enter")saveNamedView(e.currentTarget.value)};
 qa("[data-load-view]",$("settings-content")).forEach(b=>b.onclick=()=>{applySavedView(b.dataset.loadView);vSettingsToggle(false)});
 qa("[data-delete-view]",$("settings-content")).forEach(b=>b.onclick=()=>{
  recordUndo("Xóa Quick View");v22.savedViews=v22.savedViews.filter(v=>v.id!==b.dataset.deleteView);
  if(v22.activeView===b.dataset.deleteView)v22.activeView=null;
  renderTable();renderSettings();
 });
 qa("[data-rename-view]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const v=v22.savedViews.find(x=>x.id===b.dataset.renameView);if(!v)return;
  const row=b.closest(".saved-view-row"),input=document.createElement("input");
  input.className="rename-input";input.value=v.name;row.replaceChildren(input);
  const save=()=>{const text=input.value.trim();if(text&&text!==v.name){recordUndo("Đổi tên Quick View");v.name=text;}renderTable();renderSettings()};
  input.onkeydown=e=>{if(e.key==="Enter")save();if(e.key==="Escape")renderSettings()};
  input.onblur=save;input.focus();input.select();
 });
}
function vTagColorOptions(){return ["gray","brown","orange","yellow","green","blue","purple","pink","red"];}
function vTagColorEditor(f){
 return '<div class="tag-color-editor"><strong>🎨 Màu cho từng tag</strong><div class="tag-color-selector"><select id="tag-color-key" aria-label="Tag cần đổi màu">'+
 f.options.map(tag=>'<option value="'+esc(tag)+'">'+esc(tag)+'</option>').join("")+'</select></div>'+
 '<div id="tag-colors" class="tag-colors">'+vTagColorOptions().map(color=>
 '<button type="button" data-tag-color="'+color+'" title="'+color+'" aria-label="Màu '+color+'"><span class="tag-color-dot tag-color-'+color+'"></span></button>').join("")+'</div></div>';
}
function vTagEditorAttach(f){
 const select=$("tag-color-key");if(!select)return;
 const paint=()=>{const c=TAG_COLOR[select.value]||"gray";
  qa("[data-tag-color]",$("popover")).forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tagColor===c)));
 };
 select.onchange=paint;
 qa("[data-tag-color]",$("popover")).forEach(button=>button.onclick=()=>{
  const key=select.value,color=button.dataset.tagColor;if(TAG_COLOR[key]===color)return;
  recordUndo("Đổi màu tag "+key);TAG_COLOR[key]=color;
  renderTable();if($("drawer").classList.contains("open"))renderDrawer();
  paint();toast("Đã đổi màu "+key);
 });
 paint();
}
function setupV22(){
 const baseEditorHtml=editorHtml;
 editorHtml=function(f,value){const content=baseEditorHtml(f,value);return f.type==="multiselect"?content+vTagColorEditor(f):content;};
 const baseOpenEditor=openEditor;
 openEditor=function(anchor,rec,f){baseOpenEditor(anchor,rec,f);if(f.type==="multiselect")vTagEditorAttach(f);};
 const originalApply=applyCell;
 applyCell=function(rec,f,next){
  if(!f.readonly&&JSON.stringify(rec[f.key])!==JSON.stringify(next))recordUndo("Sửa "+f.label);
  return originalApply(rec,f,next);
 };
 const origRenderDrawer=renderDrawer;
 renderDrawer=function(){
  origRenderDrawer();
  const create=$("create-save");if(create){
   const original=create.onclick;
   create.onclick=event=>{
    const draft=drawerRow();if(draft?.name?.trim())recordUndo("Tạo bản ghi");
    return original(event);
   };
   create.textContent="＋ Tạo mới";
  }
 };
 const originalBind=bind;
 bind=function(){
  originalBind();
  $("add-record").innerHTML="<span>＋</span> Tạo mới";
  $("settings-btn").onclick=()=>vSettingsToggle(true);
  $("settings-close").onclick=()=>vSettingsToggle(false);
  $("settings-scrim").onclick=()=>vSettingsToggle(false);
  $("settings-back").onclick=()=>{v22.settingsScreen="home";renderSettings()};
  $("save-view").onclick=()=>vOpenSettings("views");
  $("visible-columns").onclick=()=>vOpenSettings("properties");
  $("visible-columns").querySelector("span").textContent="Hiển thị thuộc tính";
  const header=$("settings-btn").parentElement;
  const undo=document.createElement("button");undo.id="undo-v22";undo.type="button";undo.className="settings-trigger";undo.title="Hoàn tác (Ctrl+Z)";undo.textContent="↶";
  const redo=document.createElement("button");redo.id="redo-v22";redo.type="button";redo.className="settings-trigger";redo.title="Làm lại (Ctrl+Shift+Z)";redo.textContent="↷";
  header.insertBefore(undo,$("settings-btn"));header.insertBefore(redo,$("settings-btn"));
  undo.onclick=undoAction;redo.onclick=redoAction;updateUndoButton();
  document.addEventListener("keydown",event=>{
   if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=="z")return;
   if(q("#popover:not(.hidden)")&&["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;
   event.preventDefault();event.stopImmediatePropagation();
   if(event.shiftKey)redoAction();else undoAction();
  },true);
  document.addEventListener("click",event=>{
   const target=event.target;
   if(target.closest("#add-rule,#clear-rules,#reset-all,#visible-columns,#sort-btn,#prev-page,#next-page,#page-size,[data-sort]"))recordUndo("Đổi cấu hình Table");
   if(target.closest(".view-tab:not(.saved-tab)")){recordUndo("Chuyển tab");v22.activeView=null;}
  },true);
  document.addEventListener("focusin",event=>{
   if(event.target.matches("#rule-rows [data-value],#rule-rows [data-second],#search")){
    if(v22.focusUndo)return;
    v22.focusUndo=true;recordUndo("Thay đổi bộ lọc / tìm kiếm");
   }
  },true);
  document.addEventListener("focusout",event=>{
   if(event.target.matches("#rule-rows [data-value],#rule-rows [data-second],#search"))v22.focusUndo=false;
  },true);
  document.addEventListener("change",event=>{
   if(event.target.matches("#rule-rows .rule-field,#rule-rows .rule-op,#logic"))recordUndo("Thay đổi Filter");
  },true);
  $("reset-all").addEventListener("click",()=>{v22.activeView=null},true);
  const toolbar=q(".toolbar");const settingLink=document.createElement("button");
  settingLink.type="button";settingLink.className="toolbar-button";settingLink.id="group-shortcut";settingLink.textContent="▤ Nhóm";
  const spacer=q(".toolbar-spacer",toolbar);toolbar.insertBefore(settingLink,spacer);
  settingLink.onclick=()=>vOpenSettings("group");
 };
 const origRulePass=rulePass;
 rulePass=function(rec,rule){
  const f=FIELD_MAP[rule.field];
  if(f&&["relation","person"].includes(f.type)&&["contains","not_contains"].includes(rule.op)){
   const match=norm(rec[f.key]).includes(norm(rule.value));
   return !rule.value?true:rule.op==="contains"?match:!match;
  }
  return origRulePass(rec,rule);
 };
 const originalRuleControl=ruleValueControl;
 ruleValueControl=function(f,rule,position="value"){
  if(["relation","person"].includes(f.type)&&["contains","not_contains"].includes(rule.op)){
   return '<input class="rule-value-input" type="text" data-'+position+' placeholder="Nhập tên chứa..." value="'+esc(rule[position]||"")+'">';
  }
  return originalRuleControl(f,rule,position);
 };
 OPS.relation=["is","is_not","contains","not_contains","empty","not_empty"];
 OPS.person=[...OPS.relation];
 OPS.multiselect=["contains","not_contains","empty","not_empty"];
 OPS.multirelation=[...OPS.multiselect];
 OPS.email=["contains","not_contains","equals","empty","not_empty"];
 OPS.url=[...OPS.email];OPS.id=[...OPS.email];
 const originalNav=renderNav;renderNav=function(){originalNav();};
}
