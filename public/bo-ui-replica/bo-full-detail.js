/* PAP-979: shared Full Detail V2.5 derived from immutable Founder authority.
 * Domain slots and canonical command capabilities are injected. */
(function(root){
"use strict";
function create(c){
const {$,qa,esc,norm,rows,state,FIELD_MAP,FIELDS,val,formatValue,openEditor,toast,currency,computed,datetime,coreMode,moduleKey,canEdit,history,slots}=c;
const V24_ENTITY_TYPE=c.subjectType;
const V24_MUTABLE_DEMO_KEYS=new Set(["name","status","start","notes","owner","tags"]);
const V24_EVENTS=[];
let v24HistoryQuery="",selected=null;
if(!coreMode){
rows.forEach((r,i)=>{
 V24_EVENTS.push({
  id:"MOCK-AUD-"+String(i+1).padStart(4,"0"),subject_type:V24_ENTITY_TYPE,subject_id:r.id,
  occurred_at:"2026-10-"+String(21+i%4).padStart(2,"0")+"T09:20:00+07:00",
  actor_type:"STAFF",actor_id:"mock-manager",action:"registration.created",
  outcome:"SUCCESS",field:null,before:null,after:r.name,description:"Hồ sơ được tạo trong dữ liệu mô phỏng."
 });
 if(i%2===0)V24_EVENTS.push({
  id:"MOCK-AUD-STATUS-"+String(i+1).padStart(4,"0"),subject_type:V24_ENTITY_TYPE,subject_id:r.id,
  occurred_at:"2026-10-"+String(22+i%3).padStart(2,"0")+"T16:12:00+07:00",
  actor_type:"STAFF",actor_id:"mock-reception",action:"registration.status_updated",
  outcome:"SUCCESS",field:"status",before:"Bản nháp",after:r.status,
  description:"Trạng thái bản ghi được cập nhật (mock)."
 });
});
V24_EVENTS.push({
 id:"MOCK-AUD-OTHER-SUBJECT",subject_type:V24_ENTITY_TYPE,subject_id:"MOCK-OTHER",
 occurred_at:"2026-10-24T18:15:00+07:00",actor_type:"STAFF",actor_id:"mock-manager",
 action:"registration.updated",outcome:"SUCCESS",field:"status",before:"A",after:"B",
 description:"Fixture khác subject — phải không xuất hiện trong lịch sử đang xem."
});
V24_EVENTS.push({
 id:"MOCK-AUD-OTHER-TYPE",subject_type:V24_ENTITY_TYPE==="student"?"registration":"student",subject_id:rows[0].id,
 occurred_at:"2026-10-24T18:16:00+07:00",actor_type:"STAFF",actor_id:"mock-manager",
 action:"student.updated",outcome:"SUCCESS",field:"status",before:"A",after:"B",
 description:"Fixture cùng ID khác subject_type — phải bị loại trừ."
});

}
const v24Writable=f=>!f.readonly&&!["id","formula"].includes(f.type)&&(coreMode?canEdit(f):V24_MUTABLE_DEMO_KEYS.has(f.key));
function v24PropertyGrid(rec){
 const categories=[
  ["Thông tin chính",["name","id","status","student","owner","approved"]],
  ["Thông tin đăng ký",["sessions","price","total","start","appointment","classes"]],
  ["Thông tin mở rộng",["tags","notes","email","website"]]
 ];
 return (moduleKey==="registration"?categories:[["Thông tin chính",FIELDS.map(f=>f.key)]]).map(([title,keys])=>'<section class="v24-prop-section"><div class="v24-section-heading"><h4>'+esc(title)+'</h4></div><div class="v24-prop-grid">'+keys.map(key=>{
  const f=FIELD_MAP[key];if(!f)return"";
  const writable=v24Writable(f),v=val(rec,key);
  const control=writable?'<button type="button" class="v24-prop-value writable" data-detail-edit="'+esc(key)+'" aria-label="Sửa '+esc(f.label)+'">'+formatValue(f,v)+'<span class="v24-edit-glyph" aria-hidden="true">✎</span></button>':'<div class="v24-prop-value readonly" title="Chỉ đọc">'+formatValue(f,v)+'<span class="v24-lock" aria-label="Chỉ đọc">⌁</span></div>';
  return '<div class="v24-prop-item"><div class="v24-prop-key"><span class="v24-field-glyph">'+esc(f.icon)+'</span>'+esc(f.label)+'</div>'+control+'</div>';
 }).join("")+'</div></section>').join("");
}
function registrationDetail(rec){
 return '<section class="v24-intro"><div><span class="v24-eyebrow">ENTITY SNAPSHOT · '+esc(V24_ENTITY_TYPE)+' / '+esc(rec.id)+'</span><h3>Detail</h3><p>Toàn bộ properties của bản ghi, theo kiểu dữ liệu chung. Chỉ các field được API cho phép mới có thao tác chỉnh sửa.</p></div><span class="v24-demo-label">MOCK API CAPABILITIES</span></section>'+
 '<div class="v24-capability-note"><span>⌁</span> <strong>Chính sách demo:</strong> name, status, start, notes, owner, tags có thể sửa. ID, formula và các trường khác chỉ đọc. Khi tích hợp Core, quyền sửa phải lấy từ API/ACL thực và kiểm tra lại phía server — không suy ra từ prototype.</div>'+
 v24PropertyGrid(rec);
}
function registrationContent(rec){
 return '<section class="v24-intro"><div><span class="v24-eyebrow">DOMAIN SLOT · REGISTRATION</span><h3>Chuyên Sâu</h3><p>Không gian độc lập do domain adapter cung cấp theo bản chất entity; không ép chung một nội dung cho 31 module.</p></div><span class="v24-demo-label">REGISTRATION DEMO</span></section>'+
 '<div class="v24-special-grid">'+
 '<article class="v24-special-card"><div class="v24-card-icon">◉</div><h4>Học viên & chương trình</h4><p>Liên kết hồ sơ đăng ký với người học, chương trình và lớp.</p><dl><div><dt>Học viên</dt><dd>'+esc(rec.student||"—")+'</dd></div><div><dt>Lớp liên quan</dt><dd>'+esc((rec.classes||[]).join(", ")||"—")+'</dd></div></dl><div class="v24-card-foot">Relation / enrollment projection · mock</div></article>'+
 '<article class="v24-special-card"><div class="v24-card-icon">▦</div><h4>Gói học & tiêu thụ</h4><p>Vùng để hiển thị lịch sử sử dụng, gia hạn, nghiệp vụ theo domain.</p><dl><div><dt>Số buổi</dt><dd>'+esc(rec.sessions)+'</dd></div><div><dt>Giá trị ước tính</dt><dd>'+esc(currency(computed(rec)))+'</dd></div></dl><div class="v24-card-foot">Subscription / usage adapter · mock</div></article>'+
 '<article class="v24-special-card v24-full"><div class="v24-card-icon">◷</div><h4>Timeline & tài liệu liên quan</h4><p>Ví dụ vùng mở rộng: lịch hẹn, phiếu đăng ký, chứng từ, media hoặc workflow có nhiều bước. Entity khác có thể thay bằng calendar, permission matrix, Pinoria editor hoặc payroll.</p><div class="v24-schedule-chip">'+esc(datetime(rec.appointment))+' · '+esc(rec.status)+'</div></article></div>';
}
function v24AuditScoped(rec){ return coreMode?history.snapshot().events:V24_EVENTS.filter(e=>e.subject_type===V24_ENTITY_TYPE&&e.subject_id===rec.id).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))); }
function render(){
 const rec=rows.find(r=>r.id===state.detail);if(!rec)return;
 if(selected!==rec.id){selected=rec.id;v24HistoryQuery="";history.select(V24_ENTITY_TYPE,rec.id);}
 const tabs=["Detail","Chuyên Sâu","Lịch Sử"];
 if(!tabs.includes(state.tab))state.tab="Detail";
 $("detail-name").textContent=rec.name;
 $("detail-title").textContent=rec.name;
 const desc=$("detail-title").parentElement.querySelector("p");
 if(desc)desc.textContent="Full Detail: Detail · Chuyên Sâu · Lịch Sử · ID "+rec.id;
 $("detail-tabs").innerHTML=tabs.map(tab=>'<button type="button" class="detail-tab '+(state.tab===tab?"selected":"")+'" data-tab="'+esc(tab)+'">'+esc(tab)+'</button>').join("");
 const primary=state.tab==="Detail"?v24DetailContent(rec):state.tab==="Chuyên Sâu"?advanced(rec):v24HistoryContent(rec);
 const panel='<div class="detail-panel v24-main-panel">'+primary+'</div>';
 $("detail-body").classList.add("v25-full-width");$("detail-body").innerHTML=panel;
 qa("[data-tab]",$("detail-tabs")).forEach(btn=>btn.onclick=()=>{state.tab=btn.dataset.tab;render()});
 qa("[data-detail-edit]",$("detail-body")).forEach(btn=>btn.onclick=e=>{
   const key=btn.dataset.detailEdit,f=FIELD_MAP[key];
   if(!f||!v24Writable(f))return toast("Trường này chỉ đọc.");
   openEditor(e.currentTarget,rec,f);
 });
 if(state.tab==="Lịch Sử"){
  if(coreMode&&history.snapshot().phase==="idle")void history.load(v24HistoryQuery).then(paintHistory);
  paintHistory();
  const input=$("v24-history-search");
  if(input)input.oninput=e=>{v24HistoryQuery=e.target.value;if(coreMode){const loading=history.load(v24HistoryQuery);paintHistory();void loading.then(paintHistory);}else paintHistory();};
 }
};
/* END PAP-879 V2.4 FULL DETAIL BASELINE */


/* PAP-879 V2.5: lean Full Detail — no sidebar summary; compact scoped audit rows. */
function v24AuditList(rec){
 const filtered=v24AuditScoped(rec).filter(e=>!v24HistoryQuery||norm([e.action,e.actor_id,e.field,e.description].join(" ")).includes(norm(v24HistoryQuery)));
 if(!filtered.length)return '<div class="v24-audit-empty">Không có sự kiện phù hợp.</div>';
 return filtered.map(e=>{
  const fld=e.field?(FIELD_MAP[e.field]?.label||e.field):"Bản ghi";
  const display=v=>v==null?"—":Array.isArray(v)?v.join(", "):String(v);
  const dateObj=new Date(e.occurred_at);
  const dateStr=dateObj.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"});
  const timeStr=dateObj.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
  return '<article class="v25-audit-row" data-audit-subject="'+esc(e.subject_id)+'" role="listitem">'+
   '<div class="v25-audit-when"><strong>'+esc(dateStr)+'</strong><span>'+esc(timeStr)+'</span></div>'+
   '<div class="v25-audit-who"><span class="v25-person-marker">♙</span><span>'+esc(e.actor_id)+'</span></div>'+
   '<div class="v25-audit-action"><strong>'+esc(e.action)+'</strong><span>'+esc(e.description)+'</span></div>'+
   '<div class="v25-audit-changes"><span class="v25-audit-field">'+esc(fld)+'</span><div class="v25-change-flow"><span title="'+esc(display(e.before))+'">'+esc(display(e.before))+'</span><em>→</em><strong title="'+esc(display(e.after))+'">'+esc(display(e.after))+'</strong></div></div>'+
   '<span class="v25-audit-outcome">'+esc(e.outcome)+'</span>'+
  '</article>';
 }).join("");
};
function v24HistoryContent(rec){
 return '<div class="v25-history-top"><h3>Lịch Sử</h3><span class="v24-demo-label">'+(coreMode?"CORE":"MOCK DATA")+'</span></div>'+
 '<label class="v24-history-filter v25-history-filter">⌕ <input id="v24-history-search" type="search" placeholder="Tìm hành động hoặc người thực hiện..." value="'+esc(v24HistoryQuery)+'" autocomplete="off"/></label>'+
 '<div class="v25-audit-list" id="v24-history-events" role="list">'+v24AuditList(rec)+'</div>';
};
/* END PAP-879 V2.5 */


function v24DetailContent(rec){
 if(moduleKey==="registration")return registrationDetail(rec);
 return '<section class="v24-intro"><div><span class="v24-eyebrow">ENTITY SNAPSHOT · '+esc(V24_ENTITY_TYPE)+' / '+esc(rec.id)+'</span><h3>Detail</h3><p>Toàn bộ properties của bản ghi, theo kiểu dữ liệu chung. Chỉ các field được API cho phép mới có thao tác chỉnh sửa.</p></div><span class="v24-demo-label">'+(coreMode?'CORE':'MOCK API CAPABILITIES')+'</span></section>'+v24PropertyGrid(rec);
}
function advanced(rec){return slots[moduleKey]?.(rec,{esc,formatValue,FIELD_MAP,coreMode})||registrationContent(rec);}
function paintHistory(){
 if(state.tab!=="Lịch Sử"||state.detail!==selected)return;
 const box=$("v24-history-events");if(!box)return;
 if(!coreMode){box.innerHTML=v24AuditList(rows.find(r=>r.id===selected));return;}
 const snap=history.snapshot();
 box.setAttribute("aria-busy",String(snap.phase==="loading"));
 if(snap.phase==="loading")box.innerHTML='<div class="v24-audit-empty" role="status">Đang tải lịch sử…</div>';
 else if(snap.phase==="error")box.innerHTML='<div class="v24-audit-empty" role="alert">'+esc(snap.error)+'</div>';
 else box.innerHTML=v24AuditList(rows.find(r=>r.id===selected));
 let more=$("fd-history-next");if(more)more.remove();
 if(snap.phase==="ready"&&snap.nextCursor){
  more=document.createElement("button");more.id="fd-history-next";more.className="secondary-btn";more.textContent="Xem thêm";
  more.onclick=()=>{const loading=history.load(v24HistoryQuery,true);paintHistory();void loading.then(paintHistory);};box.after(more);
 }
}
return {render,reset(){selected=null;history.clear();}};
}
root.PinoBOFullDetail={create};
})(globalThis);
