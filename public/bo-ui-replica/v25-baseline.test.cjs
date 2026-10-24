const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {join}=require('node:path');
const root=join(__dirname,'v25');
test('PAP-979 approved V2.5 standalone mock visual authority remains byte-exact',()=>{
 const js=readFileSync(join(root,'playground.js'));
 assert.equal(createHash('sha256').update(js).digest('hex'),'35605c4f7fafbdcddf3d3ef82e48f12f0d2b74ef096eb544c65717340e024e65');
 const html=readFileSync(join(root,'playground.html'),'utf8');
 assert.match(html,/full-detail-v25\.css/);
 assert.doesNotMatch(html,/bo-core-pilot-adapter\.js/);
});
test('V2.5 mock history never masquerades as production subject-scoped audit',()=>{
 const js=readFileSync(join(root,'playground.js'),'utf8');
 assert.match(js,/MOCK DATA/);
 assert.match(js,/Detail/);
 assert.match(js,/Chuyên Sâu/);
 assert.match(js,/Lịch Sử/);
});
