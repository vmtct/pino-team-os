/* PAP-883 · Interactive local typed database · NO backend */
(()=>{
"use strict";
const $=id=>document.getElementById(id), q=(selector,root=document)=>root.querySelector(selector), qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));
const norm=value=>String(value??"").toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const STUDENTS=["Bảo Trân","An Nhiên","Quỳnh Chi","Minh Khang","Nhã Phương","Thái Cát Đan","Di Băng","Gia Hân"];
const CLASSES=["Artchitect","PianoHouse","Chroma Sea","Little Piner Art","CAMP Pinoria","Music Studio"];
const PEOPLE=["Hằng Nguyễn","Vy Trần","Trang Lê","Bảo Phạm","Nhi Phan","Hương Đỗ"];
const TAGS=["VIP","Renewal","Trial","Arts","Music","CAMP","Urgent","Recurring"];
const STATUSES=["Đang học","Cần xử lý","Đã duyệt","Bản nháp","Tạm dừng"];
const pilotKey=new URLSearchParams(location.search).get("module");
const pilot=Object.hasOwn(window.PinoBOPilotAdapters||{},pilotKey)?window.PinoBOPilotAdapters[pilotKey]:null;
const coreMode=pilot?.mode==="CORE";
const FIELDS=pilot?.fields||[
 {key:"name",label:"Tên bản ghi",type:"text",icon:"Aa",w:235},
 {key:"id",label:"ID",type:"id",icon:"#",w:145,readonly:true},
 {key:"status",label:"Trạng thái",type:"select",icon:"▣",options:STATUSES,w:135},
 {key:"sessions",label:"Số buổi",type:"number",icon:"#",w:113},
 {key:"price",label:"Đơn giá",type:"currency",icon:"₫",w:154},
 {key:"start",label:"Ngày bắt đầu",type:"date",icon:"▦",w:145},
 {key:"student",label:"Học viên",type:"relation",icon:"↗",options:STUDENTS,w:172},
 {key:"approved",label:"Đã duyệt?",type:"boolean",icon:"☑",w:120},
 {key:"notes",label:"Ghi chú",type:"textarea",icon:"≡",w:210},
 {key:"appointment",label:"Lịch hẹn",type:"datetime",icon:"◷",w:182},
 {key:"classes",label:"Lớp liên quan",type:"multirelation",icon:"⇄",options:CLASSES,w:206},
 {key:"owner",label:"Phụ trách",type:"person",icon:"♙",options:PEOPLE,w:162},
 {key:"tags",label:"Nhãn",type:"multiselect",icon:"⊞",options:TAGS,w:205},
 {key:"email",label:"Email",type:"email",icon:"@",w:228},
 {key:"website",label:"URL",type:"url",icon:"↗",w:195},
 {key:"total",label:"Thành tiền",type:"formula",icon:"ƒ",w:164,readonly:true}
];
const FIELD_MAP=Object.fromEntries(FIELDS.map(f=>[f.key,f]));
const DEFAULT_COLUMNS=pilot?FIELDS.map(f=>f.key):["name","id","status","sessions","price","start","student","approved"];
const NAMES=["Art Journey · Oct","Piano Standard · 6 tháng","Chroma Sea 2026","First Visit · Discovery","Piano Renewal","Artchitect · Stage 2","Workshop Gia đình","CAMP Pinoria · Mori","Little Piner Art","Music Studio · Level 1","Art Journey · Nov","Trial Combo","Studio Workshop","Chroma Sea Showcase","Piano Basic","Little Piner Music","Art Explorer","Renewal 2027"];
const rows=pilot?structuredClone(pilot.rows):NAMES.map((name,i)=>{
 const start=new Date(Date.UTC(2026,9,1+i));const ds=start.toISOString().slice(0,10);
 return {name,id:"MOCK-"+String(i+1).padStart(4,"0"),status:STATUSES[i%STATUSES.length],sessions:2+(i*3)%29,price:250000+(i%6)*75000,
  start:ds,student:STUDENTS[i%STUDENTS.length],approved:i%3===0,notes:i%4===0?"Ưu tiên gia hạn và theo dõi tiến độ sau buổi 3.":"Gói mẫu để thử editor và bộ lọc.",
  appointment:ds+"T"+String(17+i%4).padStart(2,"0")+":30",
  classes:[CLASSES[i%CLASSES.length],...(i%3===0?[CLASSES[(i+2)%CLASSES.length]]:[])],owner:PEOPLE[i%PEOPLE.length],
  tags:[TAGS[i%TAGS.length],...(i%4===0?["Urgent"]:[])],email:"parent"+(i+1)+"@example.com",
  website:i%3===0?"https://pinohouse.art":""};
});
const state={view:"all",search:"",rules:[],logic:"AND",allCols:false,sort:null,desc:false,page:1,pageSize:8,drawer:null,draft:null,detail:null,tab:"Tổng quan",popover:null,collapsed:new Set(),navQuery:""};
let nextId=rows.length+1;
const currency=v=>v==null||v===""?"—":Number(v).toLocaleString("vi-VN")+" ₫";
const date=v=>v?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(v+"T12:00:00Z")):"—";
const datetime=v=>v?date(v.slice(0,10))+" · "+v.slice(11,16):"—";
const computed=r=>Number(r.sessions||0)*Number(r.price||0);
const val=(r,k)=>k==="total"?computed(r):r[k];
const empty=v=>v===undefined||v===null||v===""||(Array.isArray(v)&&v.length===0);
const TAG_COLOR={VIP:"purple",Renewal:"blue",Trial:"gray",Arts:"orange",Music:"green",CAMP:"yellow",Urgent:"red",Recurring:"pink"};
const TAG_PALETTE=["gray","brown","orange","yellow","green","blue","purple","pink","red"];
const pill=(text,color="")=>{
 const hash=[...String(text)].reduce((sum,ch)=>((sum*31+ch.charCodeAt(0))>>>0),7);
 const cls=color?" "+color:" tag-"+(TAG_COLOR[text]||TAG_PALETTE[hash%TAG_PALETTE.length]);
 return '<span class="datatag '+cls+'">'+esc(text)+'</span>';
};
function formatValue(f,v){
 if(empty(v))return '<span class="empty-val">Trống</span>';
 switch(f.type){
 case "currency":return esc(currency(v));
 case "formula":return '<span class="formula">'+esc(currency(v))+'</span>';
 case "date":return esc(date(v));
 case "datetime":return esc(datetime(v));
 case "boolean":return '<span class="check-indicator '+(v?"on":"")+'">'+(v?"✓":"")+'</span>';
 case "select":return pill(v,/Đã duyệt/.test(v)?"green":/Cần xử lý/.test(v)?"gold":/Bản nháp/.test(v)?"gray":"blue");
 case "relation":case "person":return pill(v,"blue");
 case "multiselect":case "multirelation":return '<span class="cell-multi">'+v.slice(0,2).map(x=>pill(x)).join("")+(v.length>2?'<small>+'+(v.length-2)+'</small>':'')+'</span>';
 case "id":return '<span class="id-code">'+esc(v)+'</span>';
 case "textarea":return esc(String(v).slice(0,42)+(String(v).length>42?"…":""));
 case "url":return '<span style="color:#6754c3">↗ '+esc(String(v).replace(/^https?:\/\//,""))+'</span>';
 default:return esc(v);
 }
}
function toast(message){
 const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2100);
}
function renderNav(){
 const groups=[
  ["HỒ SƠ",[{label:"Hồ sơ đăng ký",href:"./playground.html",icon:"▤",current:true}]],
  ["SCHOOL",[{label:"Học viên",href:"./index.html?module=students",icon:"◉"},{label:"Subscriptions",href:"./index.html?module=subscriptions",icon:"▦"}]],
  ["WORKFORCE",[{label:"Staff",href:"./index.html?module=staff",icon:"♙"},{label:"Kỳ lương",href:"./index.html?module=payroll",icon:"▦"}]],
  ["PINORIA",[{label:"World",href:"./index.html?module=world",icon:"◉"},{label:"Wardrobe",href:"./index.html?module=wardrobe",icon:"✿"}]],
  ["SYSTEM",[{label:"Policies",href:"./index.html?module=policies",icon:"☷"},{label:"Audit",href:"./index.html?module=audit",icon:"≡"}]]];
 if(pilot){
  groups[1][1].splice(1,0,{label:"Classes",href:"./index.html?module=classes",icon:"▦"});
  groups.forEach(([,items])=>items.forEach(item=>{item.current=new URL(item.href,location.href).searchParams.get("module")===pilot.key;}));
 }
 let visible=groups.map(([group,items])=>({group,items:items.filter(item=>!state.navQuery||norm(item.label).includes(norm(state.navQuery)))})).filter(g=>g.items.length);
 $("lab-nav").innerHTML=visible.map(({group,items})=>{
  const shown=!!state.navQuery||!state.collapsed.has(group);
  return '<section class="nav-group"><button type="button" class="nav-group-toggle" data-group="'+group+'" aria-expanded="'+shown+'"><span>'+group+'</span><span class="nav-group-caret">'+(shown?"⌄":"›")+'</span></button>'+(shown?'<div class="nav-group-links">'+items.map(item=>'<a class="nav-link '+(item.current?"active":"")+'" href="'+item.href+'"><span class="nav-icon">'+item.icon+'</span><span class="nav-title">'+esc(item.label)+'</span></a>').join("")+'</div>':'')+'</section>';
 }).join("")||'<div class="nav-empty">Không tìm thấy module</div>';
 if(coreMode)qa("a",$("lab-nav")).forEach(link=>{
  const target=new URL(link.href,location.href);
  if(["students","classes"].includes(target.searchParams.get("module"))){target.searchParams.set("data","core");link.href=target.href;}
  else link.onclick=event=>event.preventDefault();
 });
 qa("[data-group]",$("lab-nav")).forEach(button=>button.onclick=()=>{const key=button.dataset.group;if(state.collapsed.has(key))state.collapsed.delete(key);else state.collapsed.add(key);renderNav()});
 $("collapse-all").disabled=state.collapsed.size===groups.length;
 $("expand-all").disabled=!state.collapsed.size;
}
function renderStrip(){
 $("type-strip").innerHTML=FIELDS.filter(f=>f.type!=="id").map(f=>'<button type="button" class="type-pill" data-type-key="'+f.key+'" title="'+esc(f.type)+'"><span>'+f.icon+'</span>'+esc(f.label)+'</button>').join("");
 qa("[data-type-key]").forEach(btn=>btn.onclick=()=>{
  state.allCols=true;renderTable();const th=q('[data-column="'+btn.dataset.typeKey+'"]');
  if(th)th.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
 });
}
const OPS={
 id:["contains","equals","not_contains","empty","not_empty"],
 text:["contains","equals","not_contains","empty","not_empty"],
 textarea:["contains","equals","not_contains","empty","not_empty"],
 email:["contains","equals","empty","not_empty"],url:["contains","equals","empty","not_empty"],
 number:["eq","neq","gt","gte","lt","lte","between","empty","not_empty"],
 currency:["eq","neq","gt","gte","lt","lte","between","empty","not_empty"],
 formula:["eq","neq","gt","gte","lt","lte","between","empty","not_empty"],
 date:["on","before","after","between","empty","not_empty"],
 datetime:["on","before","after","between","empty","not_empty"],
 relation:["is","is_not","empty","not_empty"],
 person:["is","is_not","empty","not_empty"],
 select:["is","is_not","empty","not_empty"],
 multiselect:["contains","not_contains","empty","not_empty"],
 multirelation:["contains","not_contains","empty","not_empty"],
 boolean:["is","is_not"]
};
const OP_LABEL={contains:"chứa",equals:"bằng",not_contains:"không chứa",empty:"trống",not_empty:"không trống",eq:"=",neq:"≠",gt:">",gte:"≥",lt:"<",lte:"≤",between:"trong khoảng",on:"vào ngày",before:"trước",after:"sau",is:"là",is_not:"không là"};
function rulePass(record,rule){
 const f=FIELD_MAP[rule.field];if(!f)return true;
 const actual=val(record,f.key),op=rule.op,v=rule.value??"";
 if(op==="empty")return empty(actual);
 if(op==="not_empty")return !empty(actual);
 if(f.type==="boolean")return (Boolean(actual)===(v==="true"))===(op==="is");
 if(["number","currency","formula"].includes(f.type)){
  const n=Number(actual),a=Number(v),b=Number(rule.second);
  if(v==="")return true;
  return {eq:n===a,neq:n!==a,gt:n>a,gte:n>=a,lt:n<a,lte:n<=a,between:n>=Math.min(a,b)&&n<=Math.max(a,b)}[op]??true;
 }
 if(["date","datetime"].includes(f.type)){
  if(!v)return true;
  const av=String(actual??"").slice(0,f.type==="date"?10:16);
  if(op==="between")return av>=v&&av<=String(rule.second||"9999-12-31");
  return {on:av===v,before:av<v,after:av>v}[op]??true;
 }
 if(Array.isArray(actual)){
  const has=actual.some(x=>norm(x)===norm(v));
  return op==="contains"?has:op==="not_contains"?!has:true;
 }
 const a=norm(actual),b=norm(v);
 if(!b)return true;
 return {contains:a.includes(b),equals:a===b,not_contains:!a.includes(b),is:a===b,is_not:a!==b}[op]??true;
}
function filtered(){
 let data=rows.filter(row=>{
  if(state.view==="pending"&&row.status!=="Cần xử lý")return false;
  if(state.view==="approved"&&!row.approved)return false;
  if(state.search.trim()){
   const all=FIELDS.map(f=>val(row,f.key)).flat().join(" ");
   if(!norm(all).includes(norm(state.search.trim())))return false;
  }
  if(state.rules.length){
   const matches=state.rules.map(rule=>rulePass(row,rule));
   if(state.logic==="AND"&&!matches.every(Boolean))return false;
   if(state.logic==="OR"&&!matches.some(Boolean))return false;
  }
  return true;
 });
 if(state.sort){
  const f=FIELD_MAP[state.sort],s=state.desc?-1:1;
  data.sort((a,b)=>{
   const av=val(a,state.sort),bv=val(b,state.sort);
   if(["number","currency","formula"].includes(f.type))return s*(Number(av)-Number(bv));
   if(f.type==="boolean")return s*(Number(av)-Number(bv));
   return s*String(av??"").localeCompare(String(bv??""),"vi");
  });
 }
 return data;
}
function visibleColumns(){return FIELDS.filter(f=>state.allCols||DEFAULT_COLUMNS.includes(f.key));}
function BODataTable(){
 const cols=visibleColumns(),data=filtered(),pages=Math.max(1,Math.ceil(data.length/state.pageSize));state.page=Math.min(state.page,pages);
 const offset=(state.page-1)*state.pageSize,visible=data.slice(offset,offset+state.pageSize);
 $("table-head").innerHTML='<tr>'+cols.map(f=>'<th data-column="'+f.key+'" style="width:'+f.w+'px;min-width:'+f.w+'px"><button type="button" data-sort="'+f.key+'" title="Sắp xếp theo '+esc(f.label)+'">'+esc(f.label)+' <span class="column-type">'+f.icon+'</span> <span class="sort-icon">'+(state.sort===f.key?(state.desc?"↓":"↑"):"↕")+'</span></button></th>').join("")+'<th style="width:56px;min-width:56px"></th></tr>';
 $("table-body").innerHTML=visible.map(row=>'<tr data-record="'+esc(row.id)+'" class="'+(state.drawer===row.id?"selected":"")+'">'+cols.map(f=>{
  const readonly=f.readonly?" readonly":"",value=val(row,f.key);
  return '<td style="min-width:'+f.w+'px;width:'+f.w+'px"><button type="button" class="typed-cell'+readonly+'" data-edit="'+f.key+'" title="'+(f.readonly?"Chỉ đọc":"Sửa "+f.label)+'" '+(f.readonly?'aria-disabled="true"':'')+'>'+formatValue(f,value)+'</button></td>';
 }).join("")+'<td style="min-width:56px;width:56px"><button type="button" class="row-open" data-open="'+esc(row.id)+'" aria-label="Quick View '+esc(row.name)+'">↗</button></td></tr>').join("")||'<tr><td colspan="'+(cols.length+1)+'"><div class="empty-table"><strong>Không có bản ghi phù hợp</strong>Thử chỉnh điều kiện hoặc xóa bộ lọc.</div></td></tr>';
 qa("[data-sort]",$("table-head")).forEach(b=>b.onclick=()=>{if(state.sort===b.dataset.sort)state.desc=!state.desc;else{state.sort=b.dataset.sort;state.desc=false;}state.page=1;renderTable()});
 qa("[data-record]",$("table-body")).forEach(tr=>{
  const rec=rows.find(r=>r.id===tr.dataset.record);
  qa("[data-edit]",tr).forEach(btn=>btn.onclick=()=>openEditor(btn,rec,FIELD_MAP[btn.dataset.edit]));
  q("[data-open]",tr).onclick=()=>openDrawer(rec.id);
  tr.onclick=e=>{if(!e.target.closest("button,input"))openDrawer(rec.id)};
 });
 $("table-count").textContent=data.length+" bản ghi";$("result-count").textContent=data.length+" / "+rows.length+" bản ghi";
 $("page-range").textContent=data.length?(offset+1)+"–"+Math.min(data.length,offset+state.pageSize)+" / "+data.length:"0 / 0";
 $("prev-page").disabled=state.page<=1;$("next-page").disabled=state.page>=pages;
 $("visible-columns").querySelector("span").textContent=state.allCols?"Cột: Tất cả":"Cột: Ưu tiên";
 $("rules-count").textContent=state.rules.length;$("rules-count").classList.toggle("hidden",!state.rules.length);
 qa("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 renderChips();
}

let renderTable=BODataTable;
function newRule(field=FIELD_MAP.sessions?"sessions":"name"){
 const f=FIELD_MAP[field],op=OPS[f.type][0];
 return {field,op,value:"",second:""};
}
function ruleValueControl(f,rule,position="value"){
 const value=rule[position]??"",label=position==="second"?"Giá trị đến":"Giá trị";
 const opts=f.options||(f.type==="boolean"?["true","false"]:null);
 if(opts)return '<select class="rule-value-input" data-'+position+' aria-label="'+label+'"><option value="">Chọn...</option>'+opts.map(item=>'<option value="'+esc(item)+'" '+(value===item?"selected":"")+'>'+esc(f.type==="boolean"?(item==="true"?"Có":"Không"):item)+'</option>').join("")+'</select>';
 const kind=["number","currency","formula"].includes(f.type)?"number":f.type==="date"?"date":f.type==="datetime"?"datetime-local":"text";
 return '<input class="rule-value-input" data-'+position+' type="'+kind+'" '+(kind==="number"?'step="any"':'')+' value="'+esc(value)+'" aria-label="'+label+'" placeholder="Giá trị">';
}
function renderRules(){
 $("logic").value=state.logic;
 $("rule-rows").innerHTML=state.rules.map((rule,i)=>{
  const f=FIELD_MAP[rule.field],ops=OPS[f.type],showValue=!["empty","not_empty"].includes(rule.op);
  return '<div class="rule-row" data-rule="'+i+'"><select class="rule-field" aria-label="Trường dữ liệu điều kiện '+(i+1)+'">'+FIELDS.map(field=>'<option value="'+field.key+'" '+(field.key===f.key?"selected":"")+'>'+esc(field.icon+"  "+field.label)+'</option>').join("")+'</select>'+
   '<select class="rule-op" aria-label="Toán tử">'+ops.map(op=>'<option value="'+op+'" '+(rule.op===op?"selected":"")+'>'+esc(OP_LABEL[op]||op)+'</option>').join("")+'</select>'+
   '<div class="rule-inputs">'+(showValue?ruleValueControl(f,rule)+(rule.op==="between"?ruleValueControl(f,rule,"second"):""):'<span style="color:#aaa3b5;font-size:11px;padding:10px">Không cần giá trị</span>')+'</div>'+
   '<button type="button" class="rule-remove" title="Xóa điều kiện" aria-label="Xóa điều kiện">×</button></div>';
 }).join("")||'<p style="font-size:11px;color:#a5a0b2">Chưa có điều kiện. Chọn “Thêm điều kiện” để bắt đầu.</p>';
 qa(".rule-row").forEach(row=>{
  const rule=state.rules[Number(row.dataset.rule)];
  q(".rule-field",row).onchange=e=>{const f=FIELD_MAP[e.target.value];rule.field=f.key;rule.op=OPS[f.type][0];rule.value="";rule.second="";state.page=1;renderRules();renderTable()};
  q(".rule-op",row).onchange=e=>{rule.op=e.target.value;state.page=1;renderRules();renderTable()};
  qa("[data-value],[data-second]",row).forEach(input=>{
   const key=input.hasAttribute("data-second")?"second":"value";
   input.oninput=e=>{rule[key]=e.target.value;state.page=1;renderTable()};
  });
  q(".rule-remove",row).onclick=()=>{state.rules.splice(Number(row.dataset.rule),1);state.page=1;renderRules();renderTable()};
 });
 renderChips();
}
function renderChips(){
 $("active-chips").classList.toggle("active",state.rules.length>0);
 $("active-chips").innerHTML=state.rules.map((rule,i)=>{
  const f=FIELD_MAP[rule.field];
  const value=["empty","not_empty"].includes(rule.op)?"":(String(rule.value||"")+(rule.op==="between"?" — "+String(rule.second||""):""));
  return '<button type="button" class="chip" data-remove-chip="'+i+'" title="Xóa điều kiện">'+esc(f.label)+" "+esc(OP_LABEL[rule.op]||rule.op)+" "+esc(value)+' &nbsp;×</button>';
 }).join("");
 qa("[data-remove-chip]").forEach(b=>b.onclick=()=>{state.rules.splice(Number(b.dataset.removeChip),1);renderRules();renderTable()});
}
function closeEditor(){state.popover=null;$("popover").classList.add("hidden");$("popover").innerHTML="";}
function applyCell(rec,f,next){
 if(f.readonly)return;
 if(coreMode){
  const editorTicket=state.popover;
  const button=$("edit-save");if(button?.disabled)return false;if(button)button.disabled=true;
  void pilot.commit(rec,f.key,next).then(confirmed=>{
   Object.assign(rec,confirmed);if(state.popover===editorTicket)closeEditor();renderTable();
   if(state.drawer===rec.id)renderDrawer();if(state.detail===rec.id)renderDetail();
   toast("Đã lưu và đọc lại từ Core");
  }).catch(error=>{const box=state.popover===editorTicket?$("edit-error"):null;if(box)box.textContent=error.message;else toast(error.message);if(button?.isConnected)button.disabled=false;});
  return false;
 }
 if(["number","currency"].includes(f.type)){
  if(!Number.isFinite(Number(next))||Number(next)<0){toast("Số phải ≥ 0");return false}
  next=Number(next);
 }
 if(f.type==="boolean")next=Boolean(next);
 if(["multiselect","multirelation"].includes(f.type))next=[...new Set(next)];
 if(f.type==="email"&&next&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)){toast("Email không hợp lệ");return false}
 if(f.type==="url"&&next&&!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(next)){toast("URL cần bắt đầu bằng https:// hoặc http://");return false}
 if(f.key==="name"&&!String(next).trim()){toast("Tên không được trống");return false}
 rec[f.key]=next;
 renderTable();
 if($("drawer").classList.contains("open")&&state.drawer===rec.id)renderDrawer();
 if(state.detail)renderDetail();
 toast("Đã cập nhật · chỉ dữ liệu mô phỏng");
 return true;
}
function editorHtml(f,value){
 if(f.type==="boolean")return '<label class="option-item"><input id="editor-bool" type="checkbox" '+(value?"checked":"")+'> Có / Đã duyệt</label>';
 if(f.type==="select")return '<select id="editor-value" class="edit-input"><option value="">— Chưa chọn —</option>'+f.options.map(x=>'<option value="'+esc(x)+'" '+(value===x?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select>';
 if(["relation","person","multiselect","multirelation"].includes(f.type)){
  const multi=["multiselect","multirelation"].includes(f.type),arr=multi?(Array.isArray(value)?value:[]):[value].filter(Boolean);
  return '<input type="search" id="editor-search" class="edit-input edit-search" placeholder="Tìm '+esc(f.label.toLowerCase())+'..." aria-label="Tìm lựa chọn">'+
   '<div class="option-list" id="editor-options">'+f.options.map(x=>'<button type="button" class="option-item" data-option="'+esc(x)+'" aria-pressed="'+arr.includes(x)+'"><span class="option-check">'+(arr.includes(x)?"✓":"＋")+'</span>'+esc(x)+'</button>').join("")+'</div>';
 }
 if(f.type==="textarea")return '<textarea id="editor-value" class="edit-input" placeholder="Ghi chú...">'+esc(value??"")+'</textarea>';
 const type={number:"number",currency:"number",date:"date",datetime:"datetime-local",email:"email",url:"url"}[f.type]||"text";
 return '<input id="editor-value" class="edit-input" type="'+type+'" '+(type==="number"?'min="0" step="'+(f.type==="currency"?"1000":"1")+'"':'')+' value="'+esc(value??"")+'" placeholder="Nhập '+esc(f.label)+'">';
}
function openEditor(anchor,rec,f){
 if(f.readonly){toast(f.key==="id"?"ID là trường bất biến":"Formula là trường chỉ đọc");return}
 if(f.type==="boolean"){applyCell(rec,f,!rec[f.key]);return}
 closeEditor();
 const current=val(rec,f.key);
 $("popover").innerHTML='<h4>'+esc(f.icon)+" "+esc(f.label)+'</h4><p>'+esc(f.type)+' · Enter lưu / Esc hủy</p><div class="edit-group">'+editorHtml(f,current)+'</div><div id="edit-error" class="edit-error"></div><div class="editor-actions"><button type="button" id="edit-cancel">Hủy</button><button type="button" class="save" id="edit-save">Lưu</button></div>';
 $("popover").classList.remove("hidden");
 const rect=anchor.getBoundingClientRect(),maxWidth=Math.min(330,innerWidth-24);
 if(innerWidth>760){
  let left=Math.min(Math.max(12,rect.left),innerWidth-maxWidth-12);
  let top=rect.bottom+8;if(top+310>innerHeight)top=Math.max(12,rect.top-325);
  $("popover").style.left=left+"px";$("popover").style.top=top+"px";
 }else{$("popover").style.left="12px";$("popover").style.top="auto"}
 const multi=["multiselect","multirelation"].includes(f.type);
 const single=["relation","person"].includes(f.type);
 const selected=new Set(Array.isArray(current)?current:[current].filter(Boolean));
 const paint=()=>qa("[data-option]",$("popover")).forEach(btn=>{
  const on=selected.has(btn.dataset.option);btn.setAttribute("aria-pressed",String(on));q(".option-check",btn).textContent=on?"✓":"＋";
 });
 qa("[data-option]",$("popover")).forEach(btn=>btn.onclick=()=>{
  const v=btn.dataset.option;
  if(single){selected.clear();selected.add(v)}else if(selected.has(v))selected.delete(v);else selected.add(v);
  paint();
 });
 if($("editor-search"))$("editor-search").oninput=e=>qa("[data-option]",$("popover")).forEach(btn=>btn.hidden=!norm(btn.dataset.option).includes(norm(e.target.value)));
 function save(){
  const el=$("editor-value");
  const next=multi?[...selected]:single?([...selected][0]||""):f.type==="boolean"?$("editor-bool").checked:el?el.value:"";
  if(!coreMode&&["number","currency"].includes(f.type)&&next===""){rec[f.key]=null;renderTable();closeEditor();return}
  if(applyCell(rec,f,next))closeEditor();
 }
 $("edit-save").onclick=save;$("edit-cancel").onclick=closeEditor;
 const input=$("editor-value")||$("editor-search");if(input){input.focus();if(input.type==="text")input.select()}
 $("popover").onkeydown=e=>{
  if(e.key==="Escape"){e.stopPropagation();closeEditor();}
  if(e.key==="Enter"&&!(e.target.tagName==="TEXTAREA")){e.preventDefault();e.stopPropagation();save();}
 };
 state.popover={rec,f};
}
function createDraft(){
 const name="";return {name,id:"",status:"Bản nháp",sessions:0,price:250000,start:"",student:"",approved:false,notes:"",appointment:"",classes:[],owner:"",tags:[],email:"",website:""};
}
function openDrawer(id=null){
 if(coreMode&&!id)return;
 closeEditor();state.drawer=id;state.draft=id?null:createDraft();
 $("drawer").classList.add("open");$("drawer").setAttribute("aria-hidden","false");
 $("drawer-scrim").classList.add("visible");document.body.style.overflow="hidden";
 renderDrawer();$("drawer-close").focus();renderTable();
}
function closeDrawer(){
 closeEditor();state.drawer=null;state.draft=null;$("drawer").classList.remove("open");$("drawer").setAttribute("aria-hidden","true");
 $("drawer-scrim").classList.remove("visible");document.body.style.overflow="";renderTable();
}
function drawerRow(){return state.draft||rows.find(r=>r.id===state.drawer)}
function BOQuickView(){
 const rec=drawerRow();if(!rec)return;
 const isNew=!!state.draft;
 $("drawer-path").textContent=(pilot?pilot.label.toLocaleUpperCase("vi"):"HỒ SƠ")+" / "+(isNew?"CREATE":"QUICK VIEW");
 $("drawer-content").innerHTML='<div class="quick-top"><span class="quick-type">Aa &nbsp; TEXT TITLE · '+(isNew?"BẢN GHI MỚI":"EDITABLE QUICK VIEW")+'</span><button type="button" id="drawer-name" class="quick-name" title="Click để đổi tên">'+esc(rec.name||"Chưa đặt tên")+" ✎"+'</button><span class="quick-id">'+esc(rec.id||"ID tạo sau khi lưu")+'</span></div>'+
  '<section class="property-section"><h3>Properties · click giá trị để sửa</h3>'+FIELDS.filter(f=>!["name","id"].includes(f.key)).map(f=>{
   const value=val(rec,f.key);
   return '<div class="property-row"><div class="property-label"><small>'+f.icon+'</small>'+esc(f.label)+'</div><button type="button" class="property-control" data-prop="'+f.key+'" '+(f.readonly?'disabled aria-disabled="true"':'')+'>'+formatValue(f,value)+(f.readonly?"":'<span class="pencil">✎</span>')+'</button></div>';
  }).join("")+'</section>';
 $("drawer-footer").innerHTML='<div class="lab-bottom"><button type="button" class="secondary-btn" id="quick-close">'+(isNew?"Hủy":"Đóng")+'</button>'+(isNew?'<button type="button" class="primary-btn" id="create-save">＋ Tạo bản ghi</button>':'<button type="button" class="primary-btn" id="full-detail">↗ Full Detail</button>')+'</div>';
 $("drawer-name").onclick=e=>openEditor(e.currentTarget,rec,FIELD_MAP.name);
 qa("[data-prop]",$("drawer-content")).forEach(btn=>btn.onclick=e=>openEditor(e.currentTarget,rec,FIELD_MAP[btn.dataset.prop]));
 $("quick-close").onclick=closeDrawer;
 if(isNew){
  $("create-save").onclick=()=>{
   if(!rec.name.trim()){toast("Hãy nhập tên bản ghi");$("drawer-name").focus();return}
   rec.id="MOCK-"+String(nextId++).padStart(4,"0");
   rows.unshift(rec);state.draft=null;state.drawer=rec.id;state.page=1;state.view="all";state.rules=[];state.search="";$("search").value="";
   renderRules();renderDrawer();renderTable();toast("Đã tạo bản ghi mô phỏng");
  };
 }else $("full-detail").onclick=()=>openDetail(rec.id);
}
let renderDrawer=BOQuickView;
function openDetail(id){
 closeEditor();const rec=rows.find(r=>r.id===id);if(!rec)return;
 state.detail=id;state.tab="Tổng quan";
 $("drawer").classList.remove("open");$("drawer-scrim").classList.remove("visible");$("drawer").setAttribute("aria-hidden","true");
 document.body.style.overflow="";state.drawer=null;
 $("list-screen").classList.add("hidden");$("detail-screen").classList.remove("hidden");
 renderDetail();window.scrollTo(0,0);
}
function BOFullDetail(){
 const rec=rows.find(r=>r.id===state.detail);if(!rec)return;
 $("detail-name").textContent=rec.name;$("detail-title").textContent=rec.name;
 const tabs=window.PinoBODesignSystem.detailTabs();
 $("detail-tabs").innerHTML=tabs.map(tab=>'<button type="button" class="detail-tab '+(state.tab===tab?"selected":"")+'" data-tab="'+tab+'">'+tab+'</button>').join("");
 const intro={ "Tổng quan":"Full Detail nhận cùng schema typed properties, nhưng có không gian riêng cho bảng liên quan, editor chuyên sâu và lịch.",
 "Hoạt động":"Các thay đổi theo thời gian, audit log và command history sẽ là nội dung riêng của từng module.",
 "Tài liệu":"Tài liệu, media và workflow dài có thể dùng tab riêng; không làm Drawer trở nên quá tải."};
 $("detail-body").innerHTML='<div class="detail-panel lab-section-panel"><h3>'+esc(state.tab)+'</h3><p>'+intro[state.tab]+'</p><div class="drawer-fields">'+FIELDS.filter(f=>pilot?!["name","id"].includes(f.key):["status","sessions","price","start","student","owner"].includes(f.key)).map(f=>'<div class="drawer-field"><dt>'+esc(f.label)+'</dt><dd>'+formatValue(f,val(rec,f.key))+'</dd></div>').join("")+'</div></div>'+
 '<div class="detail-panel detail-explain"><h3>Shared Full Detail skeleton</h3><p>Header, breadcrumbs, tab bar và responsive là dùng chung. Nội dung trong tab được module cung cấp.</p><p><strong>'+ (pilot?'ID:':'Formula:') +'</strong> '+esc(pilot?rec.id:currency(computed(rec)))+'</p><div class="detail-tile"><div><strong>01</strong><small>Table</small></div><div><strong>02</strong><small>Drawer</small></div><div><strong>03</strong><small>Full page</small></div></div></div>';
 qa("[data-tab]",$("detail-tabs")).forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderDetail()});
}
let renderDetail=BOFullDetail;
function bind(){
 $("nav-search").oninput=e=>{state.navQuery=e.target.value;renderNav()};
 $("collapse-all").onclick=()=>{["HỒ SƠ","SCHOOL","WORKFORCE","PINORIA","SYSTEM"].forEach(x=>state.collapsed.add(x));renderNav()};
 $("expand-all").onclick=()=>{state.collapsed.clear();renderNav()};
 $("menu-btn").onclick=()=>{$("sidebar").classList.add("show");$("nav-scrim").classList.add("show")};
 $("nav-scrim").onclick=()=>{$("sidebar").classList.remove("show");$("nav-scrim").classList.remove("show")};
 $("search").oninput=e=>{state.search=e.target.value;state.page=1;renderTable()};
 qa("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;renderTable()});
 $("filter-toggle").onclick=()=>{$("rules-panel").classList.toggle("hidden")};
 $("close-rules").onclick=()=>{$("rules-panel").classList.add("hidden")};
 $("add-rule").onclick=()=>{state.rules.push(newRule());renderRules();renderTable()};
 $("clear-rules").onclick=()=>{state.rules=[];state.page=1;renderRules();renderTable()};
 $("logic").onchange=e=>{state.logic=e.target.value;state.page=1;renderTable()};
 $("visible-columns").onclick=()=>{state.allCols=!state.allCols;renderTable()};
 $("reset-all").onclick=()=>{state.rules=[];state.logic="AND";state.search="";state.view="all";state.page=1;state.sort=null;state.desc=false;$("search").value="";renderRules();renderTable();toast("Đã đặt lại Table")};
 $("page-size").onchange=e=>{state.pageSize=Number(e.target.value);state.page=1;renderTable()};
 $("prev-page").onclick=()=>{state.page=Math.max(1,state.page-1);renderTable()};
 $("next-page").onclick=()=>{state.page++;renderTable()};
 $("add-record").onclick=()=>openDrawer();
 $("drawer-close").onclick=closeDrawer;$("drawer-scrim").onclick=closeDrawer;
 $("back-to-list").onclick=()=>{state.detail=null;$("detail-screen").classList.add("hidden");$("list-screen").classList.remove("hidden");renderTable();window.scrollTo(0,0)};
 document.addEventListener("pointerdown",e=>{
  if(state.popover&&!e.target.closest("#popover")&&!e.target.closest("[data-edit],[data-prop],#drawer-name"))closeEditor();
 });
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
   if(state.popover){closeEditor();return;}
   if($("drawer").classList.contains("open")){closeDrawer();return;}
   if($("sidebar").classList.contains("show")){$("nav-scrim").click();return;}
  }
  if(e.key==="/"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)){
   e.preventDefault();$("search").focus();
  }
 });
}
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
 if(coreMode)return;
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
 if(coreMode)return;
 if(!v22.undo.length){toast("Không còn thao tác để hoàn tác");return;}
 v22.redo.push({label:"redo",snapshot:vSnapshot()});
 const last=v22.undo.pop();restoreSnapshot(last.snapshot);toast("↶ Hoàn tác: "+last.label);
}
function redoAction(){
 if(coreMode)return;
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
 return {home:"Cài đặt bảng",properties:"Hiển thị thuộc tính",group:"Nhóm",filters:"Bộ lọc",views:"Quick Views"}[v22.settingsScreen];
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
  ["filters","☷","Bộ lọc","Điều kiện, toán tử và logic AND/OR"],
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
  renderTable();renderSettings();
 });
 qa("[data-bulk]",$("settings-content")).forEach(b=>b.onclick=()=>{
  recordUndo("Hiện/ẩn tất cả cột");v22.visible=b.dataset.bulk==="show"?new Set(v22.order):new Set(["name"]);
  renderTable();renderSettings();
 });
 qa("[data-move]",$("settings-content")).forEach(b=>b.onclick=()=>{
  const from=v22.order.indexOf(b.dataset.move),to=from+Number(b.dataset.step);
  if(to<1||to>=v22.order.length)return;
  recordUndo("Đổi thứ tự cột");
  [v22.order[from],v22.order[to]]=[v22.order[to],v22.order[from]];
  renderTable();renderSettings();
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
  v22.collapsed.clear();v22.hiddenGroups.clear();
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
 if(coreMode)return; // Do not claim local draft metadata is persisted Core truth.

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

setupV22();
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
 qa("#add-view-tab,.tabs-left .view-rename-input").forEach(node=>node.remove());
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
 if(coreMode)add.disabled=true;
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

if(pilot){
 document.title=pilot.label+" · PINO BO";
 $("list-screen").querySelector("h1").textContent=pilot.label;
 q(".topbar-breadcrumb strong").textContent=pilot.label;
}
window.PinoBOSharedWorkspace=Object.freeze({
 moduleKey:pilot?.key||"registration",
 BODataTable:()=>renderTable(), BOQuickView:()=>renderDrawer(), BOFullDetail:()=>renderDetail(),
 dataMode:coreMode?"CORE":"UI_ONLY_SYNTHETIC"
});
renderNav();renderStrip();renderRules();renderTable();bind();
if(coreMode){
 $("add-record").disabled=true;
 for(const tab of qa("[data-view]"))if(tab.dataset.view!=="all")tab.disabled=true;
 q("#detail-screen .eyebrow").textContent=pilot.group+" / FULL DETAIL";
 for(const link of qa("#lab-nav a")){
  const url=new URL(link.href,location.href);
  if(["students","classes"].includes(url.searchParams.get("module"))){url.searchParams.set("data","core");link.href=url.href;}
  else link.onclick=event=>event.preventDefault();
 }
 $("add-view-tab").disabled=true; // Core public-view persistence is a separate governed adapter; never fabricate success.
 const originalSettings=renderSettings;
 renderSettings=function(){originalSettings();for(const b of qa('[data-settings="views"],#confirm-save-view'))b.disabled=true;};
}
})();
