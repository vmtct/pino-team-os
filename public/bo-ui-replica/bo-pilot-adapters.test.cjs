const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const adapters=require('./bo-pilot-adapters.js');
const entry=fs.readFileSync(path.join(__dirname,'bo-pilot-entry.js'),'utf8');
test('only approved UI pilot entries route locally; query and fragment survive without open redirects',()=>{
 for(const key of ['students','classes']){
  let redirected;
  const href='https://preview-bo.pinohouse.art/bo-ui-replica/index.html?module='+key+'&q=a%26b&next=https://evil.example/#context';
  vm.runInNewContext(entry,{URL,location:{href,replace:url=>{redirected=new URL(url)}}});
  assert.equal(redirected.origin,new URL(href).origin);assert.equal(redirected.pathname,'/bo-ui-replica/playground.html');
  assert.equal(redirected.searchParams.get('module'),key);assert.equal(redirected.searchParams.get('q'),'a&b');assert.equal(redirected.hash,'#context');
 }
 for(const key of ['staff','subscriptions','payroll','__proto__','constructor','https://evil.example/']){
  let redirected=false;vm.runInNewContext(entry,{URL,location:{href:'https://preview-bo.pinohouse.art/bo-ui-replica/index.html?module='+encodeURIComponent(key),replace:()=>{redirected=true}}});
  assert.equal(redirected,false,key+' must retain existing entry');
 }
});
test('synthetic pilot fields resolve in every record and keep identity read-only',()=>{
 assert.deepEqual(Object.keys(adapters),['students','classes']);
 for(const adapter of Object.values(adapters)){
  assert.equal(adapter.fields.find(f=>f.key==='id').readonly,true);
  const ids=new Set();for(const row of adapter.rows){assert.ok(!ids.has(row.id));ids.add(row.id);for(const f of adapter.fields)assert.notEqual(row[f.key],undefined,f.key);}
 }
});
