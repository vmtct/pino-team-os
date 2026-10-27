import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,scopeLabel}=createRequire(import.meta.url)('../public/bo-authority-source/school-adapters.js');
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ok=(data:unknown,extra={})=>new Response(JSON.stringify({data,...extra}));
test('Staff/Audits projections never expose private/payload data or call detail/mutation APIs',async()=>{
 for(const [key,path,data] of [['staffs','workforce/staff-records',[{id:id(1),displayLabel:'Staff',status:'active',bank:'SECRET'}]],['audits','access/audit',[{id:id(1),action:'REAL_ACTION',occurredAt:'2026-10-25T00:00:00Z',actorType:'user',subjectType:'role',outcome:'success',payload:{secret:'SECRET'}}]]] as const){const calls:string[]=[];const rows=await load(key,async(url:string,init:RequestInit)=>{calls.push(url);assert.equal(init.method,'GET');assert.ok(url.startsWith('/api/bo/'+path));return ok(data,key==='audits'?{page:{offset:0,limit:100,total:1,hasNext:false}}:{});});assert.equal(calls.length,1);assert.doesNotMatch(JSON.stringify(rows),/SECRET|payload|password|bank/);}
});
test('Visit offset and Salary Period nextOffset traverse real pages and bind the requested Center',async()=>{
 for(const key of ['visits','salaryPeriods']){let pages=0;const rows=await load(key,async(url:string)=>{if(url==='/api/bo/centers')return ok([{id:id(9),displayName:'Test'}]);const u=new URL('https://fixture'+url),offset=Number(u.searchParams.get('offset'));assert.equal(offset,pages);pages++;return ok({data:[key==='visits'?{id:id(pages),centerId:id(9),student:{displayName:'Student'},center:{displayName:'Test'},status:'OPEN'}:{id:id(pages),centerId:id(9),name:'Period',status:'ACTIVE'}],total:2,nextOffset:offset===0?1:null});});assert.equal(rows.length,2);assert.equal(pages,2);}
 await assert.rejects(load('salaryPeriods',async(url:string)=>url==='/api/bo/centers'?ok([{id:id(9),displayName:'Test'}]):ok({data:[{id:id(1),centerId:id(8),name:'Foreign'}],nextOffset:null})),/khác cơ sở/);
});
test('Timekeeping keeps recorded/effective UTC facts separate, cursor scope and explicit maximum31day range',async()=>{
 let count=0;const rows=await load('timekeeping',async(url:string)=>{if(url.endsWith('/centers'))return ok([{id:id(9),displayLabel:'Test'}]);assert.match(url,/startDate=2026-10-01/);count++;return ok({data:[{id:id(count),centerId:id(9),staff:{displayLabel:'Staff'},status:'CLOSED',recorded:{checkInAt:'2026-10-01T01:00:00Z',checkOutAt:'2026-10-01T02:00:00Z'},effective:{checkInAt:'2026-10-01T01:10:00Z',checkOutAt:'2026-10-01T02:00:00Z',durationSeconds:3000}}],nextCursor:count===1?'next':null});},{from:'2026-10-01',to:'2026-10-25'});assert.equal(rows.length,2);assert.notEqual(rows[0].checkIn,rows[0].effectiveIn);assert.match(scopeLabel('timekeeping',{from:'2026-10-01',to:'2026-10-25'}),/2026-10-01/);
 await assert.rejects(load('timekeeping',async()=>ok([{id:id(9),displayLabel:'Test'}]),{from:'2026-01-01',to:'2026-10-25'}),/31 ngày/);
});
test('retired catalog, term, world and access screens reject module loading without calling APIs',async()=>{
 for(const key of ['worlds','sets','catalog','termWeeks','roles','users']){
  let invoked=false;
  await assert.rejects(load(key,async()=>{invoked=true;throw Error('Retired module must not fetch Core');}),/Module chưa được kết nối/);
  assert.equal(invoked,false,key);
 }
});
