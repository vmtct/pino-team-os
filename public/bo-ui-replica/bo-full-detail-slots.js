/* PAP-979: domain presentation slots, backed only by the supplied projection.
 * No specialized command/workflow is advertised without a canonical contract. */
(function(root){
"use strict";
function card(title,keys,row,{esc,formatValue,FIELD_MAP}){
 return '<article class="v24-special-card"><div class="v24-card-icon">◉</div><h4>'+esc(title)+'</h4><dl>'+keys.filter(k=>FIELD_MAP[k]).map(k=>'<div><dt>'+esc(FIELD_MAP[k].label)+'</dt><dd>'+formatValue(FIELD_MAP[k],row[k])+'</dd></div>').join("")+'</dl></article>';
}
function content(type,title,cards,row,c){
 return '<section class="v24-intro"><div><span class="v24-eyebrow">DOMAIN SLOT · '+c.esc(type)+'</span><h3>Chuyên Sâu</h3></div><span class="v24-demo-label">'+(c.coreMode?'CORE':'MOCK DATA')+'</span></section><div class="v24-special-grid">'+cards.map(([label,keys])=>card(label,keys,row,c)).join("")+'</div>';
}
root.PinoBOFullDetailSlots=Object.freeze({
 students:(row,c)=>content("STUDENT","Học viên",[
  ["Hồ sơ học viên",["name","id","birth","status"]],
  ["Học tập & thành viên",["paths","program","learning","member","sessions"]]
 ],row,c),
 classes:(row,c)=>content("RUNNING CLASS","Lớp học",[
  ["Chương trình & lịch",["name","program","schedule"]],
  ["Sức chứa & trạng thái",["capacity","status"]]
 ],row,c)
});
})(globalThis);
