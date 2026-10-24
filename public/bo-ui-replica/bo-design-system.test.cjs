const {test}=require('node:test');
const assert=require('node:assert/strict');
const ds=require('./bo-design-system.js');
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('PAP-882 common Full Detail shell preserves three levels for Students and Classes',()=>{
 for(const label of ['Học viên','Classes']){
  const header=ds.renderFullDetailHeader({group:'SCHOOL',title:label,label,subtitle:'Full Detail / Workflow',escapeHtml:esc});
  const tabs=ds.renderFullDetailTabs({tabs:ds.detailTabs(),activeTab:'Tổng quan',escapeHtml:esc});
  const context=ds.renderFullDetailContext({properties:[['Bản ghi','PIN-1'],['Module',label]],escapeHtml:esc});
  assert.match(header,/detail-cover/);assert.match(header,/detail-hero/);
  assert.match(tabs,/detail-tab selected/);assert.equal((tabs.match(/data-tab=/g)||[]).length,3);
  assert.match(context,/detail-panel detail-explain/);assert.match(context,/Context bảo toàn/);
  assert.match(context,/PIN-1/);assert.match(header,new RegExp(label));
 }
});
test('shared shell escapes untrusted title and properties',()=>{
 const header=ds.renderFullDetailHeader({group:'SCHOOL',title:'<img onerror=alert(1)>',label:'Classes',subtitle:'Full Detail',escapeHtml:esc});
 const context=ds.renderFullDetailContext({properties:[['Value','<script>alert(1)</script>']],escapeHtml:esc});
 assert.doesNotMatch(header,/<img/);assert.match(header,/&lt;img/);
 assert.doesNotMatch(context,/<script>/);assert.match(context,/&lt;script&gt;/);
});
