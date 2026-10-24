
/* PAP-879 V2.5: lean Full Detail — no sidebar summary; compact scoped audit rows. */
v24AuditList=function(rec){
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
v24HistoryContent=function(rec){
 return '<div class="v25-history-top"><h3>Lịch Sử</h3><span class="v24-demo-label">MOCK DATA</span></div>'+
 '<label class="v24-history-filter v25-history-filter">⌕ <input id="v24-history-search" type="search" placeholder="Tìm hành động hoặc người thực hiện..." value="'+esc(v24HistoryQuery)+'" autocomplete="off"/></label>'+
 '<div class="v25-audit-list" id="v24-history-events" role="list">'+v24AuditList(rec)+'</div>';
};
/* END PAP-879 V2.5 */
