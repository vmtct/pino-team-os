import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,scopeLabel}=createRequire(import.meta.url)('../public/bo-authority-source/school-adapters.js');
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ok=(data:unknown,extra={})=>new Response(JSON.stringify({data,...extra}));
test('Staff/Users/Audits projections never expose private/payload data or call detail/mutation APIs',async()=>{
 for(const [key,path,data] of [['staffs','workforce/staff-records',[{id:id(1),displayLabel:'Staff',status:'active',bank:'SECRET'}]],['users','access/users',[{id:id(1),email:'test@example.invalid',status:'active',assignments:[],password:'SECRET'}]],['audits','access/audit',[{id:id(1),action:'REAL_ACTION',occurredAt:'2026-10-25T00:00:00Z',actorType:'user',subjectType:'role',outcome:'success',payload:{secret:'SECRET'}}]]] as const){const calls:string[]=[];const rows=await load(key,async(url:string,init:RequestInit)=>{calls.push(url);assert.equal(init.method,'GET');assert.ok(url.startsWith('/api/bo/'+path));return ok(data,key==='audits'?{page:{offset:0,limit:100,total:1,hasNext:false}}:{});});assert.equal(calls.length,1);assert.doesNotMatch(JSON.stringify(rows),/SECRET|payload|password|bank/);}
});
test('Visit offset and Salary Period nextOffset traverse real pages and bind the requested Center',async()=>{
 for(const key of ['visits','salaryPeriods']){let pages=0;const rows=await load(key,async(url:string)=>{if(url==='/api/bo/centers')return ok([{id:id(9),displayName:'Test'}]);const u=new URL('https://fixture'+url),offset=Number(u.searchParams.get('offset'));assert.equal(offset,pages);pages++;return ok({data:[key==='visits'?{id:id(pages),centerId:id(9),student:{displayName:'Student'},center:{displayName:'Test'},status:'OPEN'}:{id:id(pages),centerId:id(9),name:'Period',status:'ACTIVE'}],total:2,nextOffset:offset===0?1:null});});assert.equal(rows.length,2);assert.equal(pages,2);}
 await assert.rejects(load('salaryPeriods',async(url:string)=>url==='/api/bo/centers'?ok([{id:id(9),displayName:'Test'}]):ok({data:[{id:id(1),centerId:id(8),name:'Foreign'}],nextOffset:null})),/khác cơ sở/);
});
test('Timekeeping keeps recorded/effective UTC facts separate, cursor scope and explicit maximum31day range',async()=>{
 let count=0;const rows=await load('timekeeping',async(url:string)=>{if(url.endsWith('/centers'))return ok([{id:id(9),displayLabel:'Test'}]);assert.match(url,/startDate=2026-10-01/);count++;return ok({data:[{id:id(count),centerId:id(9),staff:{displayLabel:'Staff'},status:'CLOSED',recorded:{checkInAt:'2026-10-01T01:00:00Z',checkOutAt:'2026-10-01T02:00:00Z'},effective:{checkInAt:'2026-10-01T01:10:00Z',checkOutAt:'2026-10-01T02:00:00Z',durationSeconds:3000}}],nextCursor:count===1?'next':null});},{from:'2026-10-01',to:'2026-10-25'});assert.equal(rows.length,2);assert.notEqual(rows[0].checkIn,rows[0].effectiveIn);assert.match(scopeLabel('timekeeping',{from:'2026-10-01',to:'2026-10-25'}),/2026-10-01/);
 await assert.rejects(load('timekeeping',async()=>ok([{id:id(9),displayLabel:'Test'}]),{from:'2026-01-01',to:'2026-10-25'}),/31 ngày/);
});
test('all new catalog/term adapters use exact canonical DTOs and never fabricate empty data',async()=>{
 const data:Record<string,unknown>={worlds:{worlds:[{id:id(1),displayName:'World',key:'world',worldType:'OTHER',status:'DRAFT',scenes:[],version:1}]},sets:{sets:[{id:id(1),displayName:'Set',key:'set',memberCount:0,status:'DRAFT',version:1}]},catalog:{items:[{id:id(1),displayName:'Item',key:'item',itemType:'WEARABLE',gender:'ALL',status:'DRAFT',variantCount:0}]},termWeeks:{centers:[{id:id(9),displayName:'Center'}],terms:[{id:id(8),centerId:id(9),displayName:'Term'}],termWeeks:[{id:id(1),termId:id(8),code:'W1'}]},roles:[{id:id(1),displayName:'Role',roleKey:'test',roleType:'custom',status:'active'}]};
 for(const [key,dto] of Object.entries(data)){const rows=await load(key,async()=>ok(dto));assert.equal(rows.length,1);assert.equal(rows[0].id,id(1));await assert.rejects(load(key,async()=>ok({unexpected:[]})));}
});
