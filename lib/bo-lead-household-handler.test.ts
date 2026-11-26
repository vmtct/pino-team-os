import {test} from "node:test";
import assert from "node:assert/strict";
import {handleLeadHousehold,type LeadHouseholdEnv} from "./bo-lead-household-handler";
import type {BoAccessRequest} from "./bo-core";
const host="bo.staging.pinohouse.art",base="acquisition/households",id="01a03c6e-cc58-7d81-ac8e-123456789abc",key="synthetic-lead-request-123";
function fixture(status=200){
 const calls:BoAccessRequest[]=[];
 const env:LeadHouseholdEnv={APP_ENV:"staging",PINO_BO_CORE:{executeWithStaffPassword(request,token){assert.equal(token,"synthetic");if(request.path==="context")return Promise.resolve({status:200,requestId:"context",body:{data:{userId:id,surface:"BO",entitled:true}}});calls.push(request);return Promise.resolve({status,requestId:"qa",body:status>=400?{error:{code:"ACQUISITION_INVALID_INPUT",message:"private diagnostic"}}:{data:{}}});}}};
 return {env,calls};
}
function req(method:string,suffix:string,body?:unknown,extra:Record<string,string>={},hostname=host){
 return new Request("https://"+hostname+"/api/bo/"+base+suffix,{method,headers:{host:hostname,cookie:"pino_staff_password_session=synthetic",origin:"https://"+hostname,"sec-fetch-site":"same-origin","content-type":"application/json","idempotency-key":key,"x-pino-expected-actor":id,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
test("PAP-2288 exact search body and history scope, no resource or key on read",async()=>{
 const {env,calls}=fixture();
 assert.equal((await handleLeadHousehold(req("POST","/search",{q:"synthetic",limit:20}),env)).status,200);
 const r=await handleLeadHousehold(req("GET","/"+id+"/history?limit=2&cursor=opaque"),env);
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
 assert.deepEqual(calls,[{method:"POST",path:base+"/search",body:{q:"synthetic",limit:20}},{method:"GET",path:base+"/"+id+"/history",body:{limit:2,cursor:"opaque"}}]);
});
test("PAP-2288 exact command allowlist and stable opaque key",async()=>{
 const {env,calls}=fixture();
 for(const [suffix,body] of [["",{contact:{phone:"0900000000"}}],["/"+id+"/contact",{expectedVersion:1,contact:{phone:"0900000000"}}],["/"+id+"/members/"+id+"/retire",{expectedVersion:2}],["/"+id+"/relationships/"+id+"/confirm",{expectedVersion:3}]] as const){
 assert.equal((await handleLeadHousehold(req("POST",suffix,body),env)).status,200);
 assert.deepEqual(calls.at(-1),{method:"POST",path:base+suffix,body,idempotencyKey:key});
 }
});
test("PAP-2288 rejects wrong host, support, CSRF, overposting, invalid paths before Core",async()=>{
 const {env,calls}=fixture();
 for(const [request,status] of [[req("POST","/search",{q:"x"},{origin:"https://other.invalid"}),403],[req("POST","/search",{q:"x",centerId:id}),400],[req("POST","/search?phone=123",{}),400],[req("POST","/search",{q:"x".repeat(33000)}),400],[req("POST","/"+id+"/contact",{expectedVersion:0}),400],[req("POST","/"+id+"/contact",{expectedVersion:1},{ "idempotency-key":""}),400],[req("GET","/"+id,undefined,{cookie:""}),401],[req("GET","/"+id,undefined,{cookie:"pino_staff_password_session=synthetic; pino_support_session=synthetic"}),403],[req("GET","/not-id"),404],[req("GET","/"+id+"/history?limit=101"),400],[req("GET","/"+id+"/history?limit=1&limit=2"),400],[req("GET","/search"),405],[req("POST","/"+id+"/members/"+id+"/confirm",{expectedVersion:1}),404],[req("GET","/"+id,undefined,{},"ho.staging.pinohouse.art"),404]] as const)assert.equal((await handleLeadHousehold(request,env)).status,status);
 assert.equal((await handleLeadHousehold(req("GET","/"+id),{...env,APP_ENV:"production"})).status,404);
 assert.equal(calls.length,0);
});
test("PAP-2288 propagates canonical Core status without leaking diagnostic text",async()=>{
 const {env,calls}=fixture(409);
 const r=await handleLeadHousehold(req("POST","/"+id+"/contact",{expectedVersion:1,contact:{phone:"0900000000"}}),env);
 assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:{code:"ACQUISITION_INVALID_INPUT"}});assert.equal(calls.length,1);
});
test("PAP-2288 expected actor cannot substitute identity or dispatch after context denial",async()=>{
 const {env,calls}=fixture();
 for(const [actor,status] of [["",400],["GLOBAL",400],["01a03c6e-cc58-7d81-ac8e-123456789abd",403]] as const){
  const r=await handleLeadHousehold(req("POST","",{contact:{phone:"0900000000"}},{"x-pino-expected-actor":actor}),env);
  assert.equal(r.status,status);
 }
 for(const status of [401,403,500]){
  const denied:LeadHouseholdEnv={...env,PINO_BO_CORE:{executeWithStaffPassword(request){assert.equal(request.path,"context");return Promise.resolve({status,requestId:"denied",body:{}});}}};
  assert.equal((await handleLeadHousehold(req("POST","",{contact:{phone:"0900000000"}}),denied)).status,status===500?503:status);
 }
 assert.equal(calls.length,0);
});
