import {test} from "node:test";
import assert from "node:assert/strict";
import {openNativeLeadAdapter} from "../app/bo/sales/leads/native-lead-adapter";
const actor="01a03c6e-cc58-7d81-ac8e-123456789abc",other="01a03c6e-cc58-7d81-ac8e-123456789abd",origin="https://bo.staging.pinohouse.art";
function storage(){let raw:string|null=null;return {getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;},removeItem:()=>{raw=null;}};}
test("PAP-2288 adapter binds verified actor and exact transport without caller Center",async()=>{
 const calls:Array<{url:string;init:RequestInit|undefined}>=[];
 const a=openNativeLeadAdapter(actor,origin,storage(),async(url,init)=>{calls.push({url:String(url),init});return Response.json({data:{items:[],hasMore:false,nextCursor:null}});});
 await a.api.search({q:"Synthetic",limit:10});
 assert.equal(calls[0]?.url,origin+"/api/bo/acquisition/households/search");
 assert.equal(new Headers(calls[0]?.init?.headers).get("x-pino-expected-actor"),actor);
 assert.equal(calls[0]?.init?.credentials,"same-origin");
 assert.equal(calls[0]?.init?.redirect,"error");
 assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)),{q:"Synthetic",limit:10});
 a.dispose();
 await assert.rejects(a.api.search());
 assert.equal(calls.length,1);
});
test("PAP-2288 wrong origin or malformed identity fails before dispatch",()=>{
 assert.throws(()=>openNativeLeadAdapter(actor,"https://bo.pinohouse.art",storage()));
 assert.throws(()=>openNativeLeadAdapter("GLOBAL",origin,storage()));
});
test("PAP-2288 changed actor cannot reuse the prior pending journal",()=>{
 const s=storage(),a=openNativeLeadAdapter(actor,origin,s);
 a.journal.begin({kind:"create",input:{contact:{phone:"0900000000",contactDisplayName:"Synthetic"}}},other);
 assert.equal(a.journal.inspect().state,"unknown");
 assert.ok(!s.getItem()?.includes("0900000000"));
 const b=openNativeLeadAdapter(other,origin,s);
 assert.equal(b.journal.inspect().state,"blocked");
 a.dispose();b.dispose();
});
test("PAP-2288 disposed adapter rejects response after dispatch rather than confirming it",async()=>{
 let finish:(r:Response)=>void=()=>{};
 const a=openNativeLeadAdapter(actor,origin,storage(),()=>new Promise(resolve=>{finish=resolve;}));
 const result=a.api.search();
 a.dispose();
 finish(Response.json({data:{items:[],hasMore:false,nextCursor:null}}));
 await assert.rejects(result);
});
