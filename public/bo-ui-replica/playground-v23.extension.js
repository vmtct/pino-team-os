/* PAP-885 UI v2.3 — living views, row quick button, column DnD, settings-only controls */
const v23={applying:false,viewDrag:null,columnDrag:null,menu:null,filterHost:null,filterNext:null};
function v23Sync(){
 if(v23.applying||v22.restoring||!v22.activeView)return;
 const view=v22.savedViews.find(x=>x.id===v22.activeView);
 if(view)view.config={...vCurrentView(),collapsed:[...v22.collapsed]};
}
function v23CloseMenu(){if(v23.menu){v23.menu.remove();v23.menu=null;}}
function v23Rename(id){
 const view=v22.savedViews.find(x=>x.id===id),tab=q('.saved-tab[data-saved="'+id+'"]');
 if(!view||!tab)return;
 v23CloseMenu();
 const input=document.createElement("input");input.className="view-rename-input";input.value=view.name;tab.replaceWith(input);
 let finished=false;
 const finish=save=>{if(finished)return;finished=true;const name=input.value.trim().slice(0,38);
  if(save&&name&&name!==view.name){recordUndo("Đổi tên view");view.name=name;}
  renderTable();
 };
 input.onblur=()=>finish(true);
 input.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter"){e.preventDefault();finish(true)}
  if(e.key==="Escape"){e.preventDefault();finish(false)}};
 input.focus();input.select();
}
function v23Delete(id){
 const index=v22.savedViews.findIndex(x=>x.id===id);if(index<0)return;
 recordUndo("Xóa view");v22.savedViews.splice(index,1);
 if(v22.activeView===id){v22.activeView=null;state.view="all";}
 v23CloseMenu();renderTable();toast("Đã xóa view");
}
function v23Menu(id,x,y){
 v23CloseMenu();const menu=document.createElement("div");menu.id="view-context-menu";menu.className="view-context";
 menu.setAttribute("role","menu");menu.innerHTML='<button role="menuitem" data-vaction="rename">✎ &nbsp; Đổi tên</button><button role="menuitem" data-vaction="delete">⌫ &nbsp; Xóa view</button>';
 document.body.append(menu);const b=menu.getBoundingClientRect();
 menu.style.left=Math.max(7,Math.min(x,innerWidth-b.width-7))+"px";menu.style.top=Math.max(7,Math.min(y,innerHeight-b.height-7))+"px";
 q('[data-vaction="rename"]',menu).onclick=()=>v23Rename(id);q('[data-vaction="delete"]',menu).onclick=()=>v23Delete(id);
 v23.menu=menu;q("button",menu).focus();
}
function v23ViewOrder(src,dst){
 const i=v22.savedViews.findIndex(x=>x.id===src),j=v22.savedViews.findIndex(x=>x.id===dst);
 if(src===dst||i<0||j<0)return;
 recordUndo("Đổi thứ tự view");const [item]=v22.savedViews.splice(i,1);v22.savedViews.splice(j,0,item);renderTable();
}
const originalViewTabs=vRenderSavedTabs;
vRenderSavedTabs=function(){
 originalViewTabs();const parent=q(".tabs-left");if(!parent)return;
 for(const tab of qa(".saved-tab",parent)){
  const id=tab.dataset.saved;tab.draggable=true;tab.title="Chuột phải: đổi tên/xóa · kéo thả: sắp xếp";
  tab.oncontextmenu=e=>{e.preventDefault();v23Menu(id,e.clientX,e.clientY)};
  tab.onkeydown=e=>{if(e.key==="F2"){e.preventDefault();v23Rename(id)}
   if((e.shiftKey&&e.key==="F10")){e.preventDefault();const b=tab.getBoundingClientRect();v23Menu(id,b.left,b.bottom)}};
  tab.ondragstart=e=>{v23.viewDrag=id;e.dataTransfer.setData("text/plain","view:"+id);e.dataTransfer.effectAllowed="move";tab.classList.add("dragging")};
  tab.ondragover=e=>{if(!v23.viewDrag)return;e.preventDefault();tab.classList.add("drag-target")};
  tab.ondragleave=()=>tab.classList.remove("drag-target");
  tab.ondrop=e=>{e.preventDefault();const src=v23.viewDrag;v23.viewDrag=null;v23ViewOrder(src,id)};
  tab.ondragend=()=>{v23.viewDrag=null;tab.classList.remove("dragging","drag-target")};
 }
 const add=document.createElement("button");add.type="button";add.id="add-view-tab";add.className="view-add";
 add.textContent="＋";add.title="Lưu trạng thái hiện tại thành view";add.setAttribute("aria-label","Thêm view");
 add.onclick=()=>{
  let n=1;while(v22.savedViews.some(x=>x.name==="View "+n))n++;
  v23Sync();saveNamedView("View "+n);vSettingsToggle(false);v23Rename(v22.activeView);
 };
 parent.append(add);
};
const oldApplyView=applySavedView;
applySavedView=function(id){
 v23Sync();v23.applying=true;
 try{oldApplyView(id);const view=v22.savedViews.find(x=>x.id===id);
  if(view?.config?.collapsed)v22.collapsed=new Set(view.config.collapsed);
 }finally{v23.applying=false;}
 renderTable();
};
function v23TableDrag(){
 const header=q("#table-head tr");if(header&&header.children.length>1){
  const quick=header.lastElementChild;quick.classList.add("quick-open-th");header.prepend(quick);
 }
 for(const row of qa("#table-body tr[data-record]")){
  const cell=row.lastElementChild;cell.classList.add("first-quick-cell");row.prepend(cell);
 }
 for(const th of qa("#table-head th[data-column]")){
  const field=th.dataset.column;th.draggable=field!=="name";
  if(field==="name"){th.title="Cột tên được cố định";continue;}
  th.classList.add("column-draggable");th.title="Kéo để sắp xếp cột";
  th.ondragstart=e=>{v23.columnDrag=field;e.dataTransfer.setData("text/plain","col:"+field);e.dataTransfer.effectAllowed="move";th.classList.add("dragging")};
  th.ondragover=e=>{if(v23.columnDrag){e.preventDefault();th.classList.add("drag-target")}};
  th.ondragleave=()=>th.classList.remove("drag-target");
  th.ondrop=e=>{e.preventDefault();const src=v23.columnDrag;v23.columnDrag=null;th.classList.remove("drag-target");if(src)reorderColumn(src,field)};
  th.ondragend=()=>{v23.columnDrag=null;th.classList.remove("dragging","drag-target")};
 }
}
const oldRenderTable=renderTable;
renderTable=function(){v23Sync();oldRenderTable();v23TableDrag();};
function v23FilterHome(){
 if(v23.filterHost)return;
 const panel=$("rules-panel");v23.filterHost=panel.parentNode;v23.filterNext=panel.nextSibling;
}
function v23ReturnFilter(){
 v23FilterHome();const panel=$("rules-panel");
 if(panel.parentNode!==v23.filterHost)v23.filterHost.insertBefore(panel,v23.filterNext);
 panel.classList.add("hidden");
}
const oldRenderSettings=renderSettings;
renderSettings=function(){
 v23FilterHome();
 if(v22.settingsScreen!=="filters"){v23ReturnFilter();return oldRenderSettings();}
 $("settings-title").textContent="Bộ lọc";$("settings-back").style.visibility="visible";
 const content=$("settings-content"),panel=$("rules-panel");content.replaceChildren();
 content.append(panel);panel.classList.remove("hidden");
 $("close-rules").classList.add("hidden");$("save-view").classList.add("hidden");renderRules();
};
const oldSettingsToggle=vSettingsToggle;
vSettingsToggle=function(open,screen="home"){if(!open)v23ReturnFilter();return oldSettingsToggle(open,screen);};
function setupV23(){
 const oldBind=bind;
 bind=function(){
  oldBind();
  $("filter-toggle").onclick=()=>vOpenSettings("filters");
  document.addEventListener("pointerdown",event=>{if(v23.menu&&!event.target.closest("#view-context-menu"))v23CloseMenu()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")v23CloseMenu()});
 };
}
setupV23();
