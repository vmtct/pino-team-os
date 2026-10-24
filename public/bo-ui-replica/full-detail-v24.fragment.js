
/* PAP-879 V2.4: Founder Full Detail baseline — injected inside existing Playground closure. */
const V24_ENTITY_TYPE="registration";
const V24_MUTABLE_DEMO_KEYS=new Set(["name","status","start","notes","owner","tags"]);
const V24_CAPABILITY_LABEL="API capability demo · chưa kết nối Core";
const V24_EVENTS=[];
let v24HistoryQuery="";
const v24Copy=x=>JSON.parse(JSON.stringify(x));
const v24Equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
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
 id:"MOCK-AUD-OTHER-TYPE",subject_type:"student",subject_id:rows[0].id,
 occurred_at:"2026-10-24T18:16:00+07:00",actor_type:"STAFF",actor_id:"mock-manager",
 action:"student.updated",outcome:"SUCCESS",field:"status",before:"A",after:"B",
 description:"Fixture cùng ID khác subject_type — phải bị loại trừ."
});
const v24OldApplyCell=applyCell;
applyCell=function(rec,f,next){
 const before=v24Copy(rec[f.key]??null);
 const success=v24OldApplyCell(rec,f,next);
 if(success&& !v24Equal(before,rec[f.key])){
  V24_EVENTS.push({
   id:"MOCK-AUD-NEW-"+String(V24_EVENTS.length+1).padStart(4,"0"),
   subject_type:V24_ENTITY_TYPE,subject_id:rec.id,
   occurred_at:new Date().toISOString(),actor_type:"STAFF",actor_id:"mock-current-user",
   action:"registration.field_updated",outcome:"SUCCESS",
   field:f.key,before,after:v24Copy(rec[f.key]??null),
   description:"Chỉnh sửa mock trong Playground (không ghi vào D1)."
  });
 }
 return success;
};
const v24OriginalOpenDetail=openDetail;
openDetail=function(id){
 v24HistoryQuery="";
 v24OriginalOpenDetail(id);
 if(state.detail){state.tab="Detail";renderDetail();}
};
const v24CurrentRec=()=>rows.find(r=>r.id===state.detail);
const v24Writable=f=>!f.readonly&&V24_MUTABLE_DEMO_KEYS.has(f.key);
function v24PropertyGrid(rec){
 const categories=[
  ["Thông tin chính",["name","id","status","student","owner","approved"]],
  ["Thông tin đăng ký",["sessions","price","total","start","appointment","classes"]],
  ["Thông tin mở rộng",["tags","notes","email","website"]]
 ];
 return categories.map(([title,keys])=>'<section class="v24-prop-section"><div class="v24-section-heading"><h4>'+esc(title)+'</h4></div><div class="v24-prop-grid">'+keys.map(key=>{
  const f=FIELD_MAP[key];if(!f)return"";
  const writable=v24Writable(f),v=val(rec,key);
  const control=writable?'<button type="button" class="v24-prop-value writable" data-detail-edit="'+esc(key)+'" aria-label="Sửa '+esc(f.label)+'">'+formatValue(f,v)+'<span class="v24-edit-glyph" aria-hidden="true">✎</span></button>':'<div class="v24-prop-value readonly" title="Read-only theo API capability mock">'+formatValue(f,v)+'<span class="v24-lock" aria-label="Chỉ đọc">⌁</span></div>';
  return '<div class="v24-prop-item"><div class="v24-prop-key"><span class="v24-field-glyph">'+esc(f.icon)+'</span>'+esc(f.label)+'</div>'+control+'</div>';
 }).join("")+'</div></section>').join("");
}
function v24DetailContent(rec){
 return '<section class="v24-intro"><div><span class="v24-eyebrow">ENTITY SNAPSHOT · '+esc(V24_ENTITY_TYPE)+' / '+esc(rec.id)+'</span><h3>Detail</h3><p>Toàn bộ properties của bản ghi, theo kiểu dữ liệu chung. Chỉ các field được API cho phép mới có thao tác chỉnh sửa.</p></div><span class="v24-demo-label">MOCK API CAPABILITIES</span></section>'+
 '<div class="v24-capability-note"><span>⌁</span> <strong>Chính sách demo:</strong> name, status, start, notes, owner, tags có thể sửa. ID, formula và các trường khác chỉ đọc. Khi tích hợp Core, quyền sửa phải lấy từ API/ACL thực và kiểm tra lại phía server — không suy ra từ prototype.</div>'+
 v24PropertyGrid(rec);
}
function v24AdvancedContent(rec){
 return '<section class="v24-intro"><div><span class="v24-eyebrow">DOMAIN SLOT · REGISTRATION</span><h3>Chuyên Sâu</h3><p>Không gian độc lập do domain adapter cung cấp theo bản chất entity; không ép chung một nội dung cho 31 module.</p></div><span class="v24-demo-label">REGISTRATION DEMO</span></section>'+
 '<div class="v24-special-grid">'+
 '<article class="v24-special-card"><div class="v24-card-icon">◉</div><h4>Học viên & chương trình</h4><p>Liên kết hồ sơ đăng ký với người học, chương trình và lớp.</p><dl><div><dt>Học viên</dt><dd>'+esc(rec.student||"—")+'</dd></div><div><dt>Lớp liên quan</dt><dd>'+esc((rec.classes||[]).join(", ")||"—")+'</dd></div></dl><div class="v24-card-foot">Relation / enrollment projection · mock</div></article>'+
 '<article class="v24-special-card"><div class="v24-card-icon">▦</div><h4>Gói học & tiêu thụ</h4><p>Vùng để hiển thị lịch sử sử dụng, gia hạn, nghiệp vụ theo domain.</p><dl><div><dt>Số buổi</dt><dd>'+esc(rec.sessions)+'</dd></div><div><dt>Giá trị ước tính</dt><dd>'+esc(currency(computed(rec)))+'</dd></div></dl><div class="v24-card-foot">Subscription / usage adapter · mock</div></article>'+
 '<article class="v24-special-card v24-full"><div class="v24-card-icon">◷</div><h4>Timeline & tài liệu liên quan</h4><p>Ví dụ vùng mở rộng: lịch hẹn, phiếu đăng ký, chứng từ, media hoặc workflow có nhiều bước. Entity khác có thể thay bằng calendar, permission matrix, Pinoria editor hoặc payroll.</p><div class="v24-schedule-chip">'+esc(datetime(rec.appointment))+' · '+esc(rec.status)+'</div></article></div>';
}
function v24AuditScoped(rec){
 return V24_EVENTS.filter(e=>e.subject_type===V24_ENTITY_TYPE&&e.subject_id===rec.id)
 .sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)));
}
function v24AuditList(rec){
 const events=v24AuditScoped(rec);
 const searched=events.filter(e=>!v24HistoryQuery||norm([e.action,e.actor_id,e.field,e.description].join(" ")).includes(norm(v24HistoryQuery)));
 const list=searched.length?searched.map(e=>{
  const fieldLabel=e.field?(FIELD_MAP[e.field]?.label||e.field):"Bản ghi";
  const before=e.before==null?"—":Array.isArray(e.before)?e.before.join(", "):String(e.before);
  const after=e.after==null?"—":Array.isArray(e.after)?e.after.join(", "):String(e.after);
  return '<article class="v24-audit-event" data-audit-subject="'+esc(e.subject_id)+'"><div class="v24-audit-icon">↗</div><div class="v24-audit-content"><div class="v24-audit-title"><strong>'+esc(e.action)+'</strong><span class="v24-outcome">'+esc(e.outcome)+'</span></div><p>'+esc(e.description)+'</p><div class="v24-diff"><span>'+esc(fieldLabel)+'</span><code>'+esc(before)+'</code><span>→</span><code>'+esc(after)+'</code></div><small>'+esc(e.actor_type)+' · '+esc(e.actor_id)+' · '+esc(new Date(e.occurred_at).toLocaleString("vi-VN"))+'</small></div></article>';
 }).join(""):'<div class="v24-audit-empty">Không có sự kiện audit phù hợp với bộ lọc cho bản ghi này.</div>';
 return list;
}
function v24HistoryContent(rec){
 const scope=V24_ENTITY_TYPE+" · "+rec.id;
 return '<section class="v24-intro"><div><span class="v24-eyebrow">AUDIT TRAIL · SUBJECT SCOPED</span><h3>Lịch Sử</h3><p>Chỉ hiển thị audit events khớp chính xác <code>subject_type</code> và <code>subject_id</code> của hồ sơ đang xem.</p></div><span class="v24-demo-label">MOCK AUDIT · NOT PROD</span></section>'+
 '<div class="v24-history-scope"><div><span>Chủ thể đang xem</span><strong>'+esc(scope)+'</strong></div><div><span>Sự kiện của chủ thể</span><strong>'+v24AuditScoped(rec).length+'</strong></div></div>'+
 '<label class="v24-history-filter">⌕ <input id="v24-history-search" type="search" placeholder="Lọc hành động / actor trong hồ sơ này..." value="'+esc(v24HistoryQuery)+'" autocomplete="off"/></label>'+
 '<div id="v24-history-events" class="v24-audit-list">'+v24AuditList(rec)+'</div>'+
 '<div class="v24-audit-contract">Production mapping: <code>audit_events.subject_type</code> + <code>audit_events.subject_id</code>, order by <code>occurred_at DESC</code>. Backend bắt buộc áp dụng ACL, pagination và giới hạn dữ liệu nhạy cảm. Không dùng client-side filtering của toàn bộ audit table để thay thế.</div>';
}
renderDetail=function(){
 const rec=v24CurrentRec();if(!rec)return;
 const tabs=["Detail","Chuyên Sâu","Lịch Sử"];
 if(!tabs.includes(state.tab))state.tab="Detail";
 $("detail-name").textContent=rec.name;
 $("detail-title").textContent=rec.name;
 const desc=$("detail-title").parentElement.querySelector("p");
 if(desc)desc.textContent="Full Detail: Detail · Chuyên Sâu · Lịch Sử · ID "+rec.id;
 $("detail-tabs").innerHTML=tabs.map(tab=>'<button type="button" class="detail-tab '+(state.tab===tab?"selected":"")+'" data-tab="'+esc(tab)+'">'+esc(tab)+'</button>').join("");
 const primary=state.tab==="Detail"?v24DetailContent(rec):state.tab==="Chuyên Sâu"?v24AdvancedContent(rec):v24HistoryContent(rec);
 const panel='<div class="detail-panel v24-main-panel">'+primary+'</div>';
 const side='<aside class="detail-panel detail-explain v24-side-panel"><h3>Hồ sơ</h3><p class="v24-aside-id">'+esc(rec.id)+'</p><dl class="drawer-fields"><div class="drawer-field"><dt>Trạng thái</dt><dd>'+formatValue(FIELD_MAP.status,rec.status)+'</dd></div><div class="drawer-field"><dt>Học viên</dt><dd>'+formatValue(FIELD_MAP.student,rec.student)+'</dd></div><div class="drawer-field"><dt>Phụ trách</dt><dd>'+formatValue(FIELD_MAP.owner,rec.owner)+'</dd></div></dl><p class="v24-aside-foot">Shared Full Detail shell. Nội dung chuyên biệt do module khai báo. Mock data only.</p><div class="detail-tile"><div><strong>01</strong><small>Table</small></div><div><strong>02</strong><small>Drawer</small></div><div><strong>03</strong><small>Detail</small></div></div></aside>';
 $("detail-body").innerHTML=panel+side;
 qa("[data-tab]",$("detail-tabs")).forEach(btn=>btn.onclick=()=>{state.tab=btn.dataset.tab;renderDetail()});
 qa("[data-detail-edit]",$("detail-body")).forEach(btn=>btn.onclick=e=>{
   const key=btn.dataset.detailEdit,f=FIELD_MAP[key];
   if(!f||!v24Writable(f))return toast("Field không được API capability demo cho phép sửa.");
   openEditor(e.currentTarget,rec,f);
 });
 if(state.tab==="Lịch Sử"){
  const input=$("v24-history-search");
  if(input)input.oninput=e=>{v24HistoryQuery=e.target.value;$("v24-history-events").innerHTML=v24AuditList(rec);};
 }
};
/* END PAP-879 V2.4 FULL DETAIL BASELINE */
