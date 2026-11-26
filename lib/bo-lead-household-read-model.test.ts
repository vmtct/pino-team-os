import {test} from "node:test";
import assert from "node:assert/strict";
import {LeadApiError,type LeadDetail,type LeadRow,type LeadIntent,type LeadPage} from "./bo-lead-household-client";
import {LeadReadModel} from "../app/bo/sales/leads/lead-household-read-model";
const a="01a03c6e-cc58-7d81-ac8e-123456789abc",b="01a03c6e-cc58-7d81-ac8e-123456789abd";
function row(id=a):LeadRow{return {id,phone:"0900000000",contactDisplayName:null,status:"ACTIVE",primaryContactMemberId:null,version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdBy:null,updatedBy:null,centerId:null,memberCount:2,intentCount:1};}
function detail(id=a):LeadDetail{return {...row(id),members:[],relationships:[],intents:[],intentHistoryHasMore:false};}
const intent:LeadIntent={id:b,kind:"GENERAL_INQUIRY",sourceBrand:"PINO_HOUSE",sourceSurface:"STAFF",status:"SUBMITTED",createdAt:"2026-11-25T00:00:00Z",version:1};
const page=<T>(items:T[],cursor:string|null=null):LeadPage<T>=>({items,hasMore:cursor!==null,nextCursor:cursor});
const base={search:async()=>page<LeadRow>([]),detail:async(id:string)=>detail(id),history:async()=>page<LeadIntent>([])};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test("PAP-2288 directory ignores late search and retains authoritative row counts",async()=>{
 const old=deferred<LeadPage<LeadRow>>();let calls=0;const m=new LeadReadModel({...base,search:async()=>++calls===1?old.promise:page([row(b)])});
 const first=m.search({q:"old"});assert.equal(m.directory.phase,"loading");await m.search({q:"new"});old.resolve(page([row()]));await first;
 assert.deepEqual(m.directory.items.map(x=>x.id),[b]);assert.equal(m.directory.items[0]?.memberCount,2);
});
test("PAP-2288 pagination deduplicates and rejects repeated cursor without stale rows",async()=>{
 let count=0;const m=new LeadReadModel({...base,search:async()=>++count===1?page([row()],"c1"):count===2?page([row(),row(b)],"c2"):page([row(b)],"c2")});
 await m.search({});await m.nextDirectory();assert.deepEqual(m.directory.items.map(x=>x.id),[a,b]);await m.nextDirectory();assert.equal(m.directory.phase,"error");assert.equal(m.directory.error?.code,"LEAD_PAGE_INVALID");assert.deepEqual(m.directory.items,[]);
});
test("PAP-2288 selected exact deep link wins over old response and mismatched IDs fail closed",async()=>{
 const old=deferred<LeadDetail>();let count=0;const m=new LeadReadModel({...base,detail:async(id)=>++count===1?old.promise:count===2?detail(id):detail(a)});
 const first=m.select(a);await m.select(b);old.resolve(detail(a));await first;assert.equal(m.selected.record?.id,b);
 await m.select(b);assert.equal(m.selected.record,null);assert.equal(m.selected.error?.code,"LEAD_READBACK_MISMATCH");
});
test("PAP-2288 acquisition history separate from member interests and isolated to selected lead",async()=>{
 const old=deferred<LeadPage<LeadIntent>>();let count=0;const m=new LeadReadModel({...base,history:async()=>++count===1?old.promise:page([intent])});
 await m.select(a);const first=m.openHistory();await m.select(b);await m.openHistory();old.resolve(page([]));await first;assert.deepEqual(m.history.items,[intent]);
 await m.select(null);assert.equal(m.selected.phase,"idle");assert.equal(m.history.phase,"idle");
});
test("PAP-2288 errors do not fall back to sample data; disposal ignores late completions",async()=>{
 const pending=deferred<LeadPage<LeadRow>>();let count=0;const m=new LeadReadModel({...base,search:async()=>++count===1?Promise.reject(new LeadApiError(403,"DENIED",null)):pending.promise});
 await m.search({});assert.equal(m.directory.phase,"error");assert.deepEqual(m.directory.items,[]);assert.equal(m.directory.error?.status,403);
 const request=m.search({});m.dispose();pending.resolve(page([row()]));await request;assert.equal(m.directory.phase,"idle");assert.deepEqual(m.directory.items,[]);
});

test("PAP-2288 cursor overlap preserves newest Lead version and admits a newer update",async()=>{
 let count=0;const v3={...row(),version:3,contactDisplayName:"Newest",memberCount:3};const v4={...v3,version:4,status:"ARCHIVED" as const};const m=new LeadReadModel({...base,search:async()=>++count===1?page([v3],"c1"):count===2?page([row(),row(b)],"c2"):count===3?page([v4]):page([row()])});
 await m.search({});await m.nextDirectory();assert.deepEqual(m.directory.items,[v3,row(b)]);
 await m.nextDirectory();assert.deepEqual(m.directory.items,[v4,row(b)]);
 await m.search({});assert.deepEqual(m.directory.items,[row()]);
});
test("PAP-2288 cursor overlap cannot revert closed acquisition history",async()=>{
 const closed={...intent,status:"CLOSED" as const,version:3};let count=0;
 const m=new LeadReadModel({...base,history:async()=>++count===1?page([closed],"h1"):page([intent])});
 await m.select(a);await m.openHistory();await m.nextHistory();assert.deepEqual(m.history.items,[closed]);
});
test("PAP-2288 malformed version on cursor page fails closed",async()=>{
 let count=0;const m=new LeadReadModel({...base,search:async()=>++count===1?page([row()],"c1"):page([{...row(b),version:0}])});
 await m.search({});await m.nextDirectory();assert.equal(m.directory.phase,"error");assert.equal(m.directory.error?.code,"LEAD_PAGE_INVALID");assert.deepEqual(m.directory.items,[]);
});
