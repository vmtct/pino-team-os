import test from "node:test";
import assert from "node:assert/strict";
import {handleHoPersonRequest} from "./ho-person-handler";
import type {HoWorldEnv} from "./ho-world-handler";
const base="https://ho.staging.pinohouse.art",path="/api/ho/identity/persons",id="019d2170-0000-7000-8000-000000000001";
const calls:unknown[]=[];
function env(o:{founder?:boolean;grant?:boolean;binding?:boolean;staging?:boolean}={}):HoWorldEnv{
 return {APP_ENV:o.staging===false?"production":"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{async executeWithStaffPassword(r,token){
 if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
 if(r.path==="ho/admission")return {status:o.founder===false?403:200,requestId:"qa",body:{data:{admitted:o.founder!==false}}};
 assert.equal(r.path,"context");return {status:200,requestId:"qa",body:{data:{userId:o.founder===false?"manager":"founder",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:o.grant===false?["team.bo.access"]:["team.bo.access","identity.person.ho_view"]}}};
 }},...(o.binding===false?{}:{PINO_HO_WORLD_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:200,requestId:"person-qa",body:{data:{}}};}}})};
}
const req=(suffix="",method="GET",host=base,token="valid")=>new Request(host+path+suffix,{method,headers:{host:new URL(host).hostname,cookie:"pino_staff_password_session="+token}});
test("PAP-2180 read only exact host, path, bounded query and no RPC on invalid",async()=>{
 calls.length=0;
 for(const h of ["https://bo.staging.pinohouse.art","https://ho.pinohouse.art","https://tos.staging.pinohouse.art"])assert.equal((await handleHoPersonRequest(req("","GET",h),env())).status,404);
 for(const s of ["/bad","/"+id+"/extra","?centerId="+id,"?limit=101","?limit=1&limit=2","?after=x","/"+id+"?q=x"])assert.ok([400,404].includes((await handleHoPersonRequest(req(s),env())).status));
 assert.equal((await handleHoPersonRequest(req("","POST"),env())).status,405);assert.equal(calls.length,0);
});
test("PAP-2180 Founder and dedicated grant, private RPC and no-store",async()=>{
 calls.length=0;
 for(const [o,status] of [[{founder:false},403],[{grant:false},403],[{binding:false},503],[{staging:false},404]] as const)assert.equal((await handleHoPersonRequest(req(),env(o))).status,status);
 assert.equal((await handleHoPersonRequest(req("","GET",base,"expired"),env())).status,401);assert.equal(calls.length,0);
 const r=await handleHoPersonRequest(req("?limit=100&q=QA"),env());assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 await handleHoPersonRequest(req("/"+id),env());await handleHoPersonRequest(req("/unlinked-counts"),env());
 assert.deepEqual(calls,[{r:{method:"GET",path:"identity/persons?limit=100&q=QA"},token:"valid"},{r:{method:"GET",path:"identity/persons/"+id},token:"valid"},{r:{method:"GET",path:"identity/persons/unlinked-counts"},token:"valid"}]);
});
