import test from "node:test";
import assert from "node:assert/strict";
import {handleHoPlsWishRequest} from "./ho-pls-wish-handler";
import type {HoItemEnv} from "./ho-pinoria-item-handler";
const base="https://ho.staging.pinohouse.art/api/ho/pinoria/pls-wish/config/";
const calls:unknown[]=[];
function env(o:{founder?:boolean;view?:boolean;manage?:boolean;itemView?:boolean;binding?:boolean;production?:boolean}={}):HoItemEnv{
 return {APP_ENV:o.production?"production":"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{async executeWithStaffPassword(r,token){
 if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
 if(r.path==="ho/admission")return {status:o.founder===false?403:200,requestId:"qa",body:{data:{admitted:o.founder!==false}}};
 return {status:200,requestId:"qa",body:{data:{userId:o.founder===false?"manager":"founder",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:["team.bo.access",...(o.view===false?[]:["pinoria.wish.config.view"]),...(o.manage===false?[]:["pinoria.wish.config.manage"]),...(o.itemView===false?[]:["pinoria.item.view"])]}}};
 }},...(o.binding===false?{}:{PINO_HO_ITEM_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:200,requestId:"wish-qa",body:{data:[]}};}}})};
}
function req(url=base+"policies",method="GET",token="valid",body?:unknown){return new Request(url,{method,headers:{host:new URL(url).hostname,cookie:"pino_staff_password_session="+token,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});}
test("HO Wish exact path, host, method, environment, private binding and view/manage split",async()=>{
 calls.length=0;
 for(const url of [base+"unknown",base+"policies?actor=1",base+"policies/x",base.replace("ho.staging","bo.staging")+"policies",base.replace("ho.staging","tos.staging")+"policies"])assert.equal((await handleHoPlsWishRequest(req(url),env())).status,404);
 for(const options of [{founder:false},{view:false},{production:true},{binding:false}])assert.equal((await handleHoPlsWishRequest(req(),env(options))).status,options.production?404:options.binding===false?503:403);
 assert.equal((await handleHoPlsWishRequest(req(base+"savePolicy","POST","valid",{}),env({manage:false}))).status,403);
 assert.equal((await handleHoPlsWishRequest(req(base+"policies","POST","valid",{}),env())).status,405);
 assert.equal((await handleHoPlsWishRequest(req(base+"policies","GET","expired"),env())).status,401);
 assert.equal(calls.length,0);
});
test("published Item catalog and revision preview require separate Item view",async()=>{
 calls.length=0;const p="item-preview/0198d050-56c1-7ac5-b9ab-b0e45d912345/3";
 for(const path of ["items",p,p.replace("item-preview","item-record")]){assert.equal((await handleHoPlsWishRequest(req(base+path),env({itemView:false}))).status,403);assert.equal((await handleHoPlsWishRequest(req(base+path),env({manage:false}))).status,200);}
 assert.equal(calls.length,3);assert.equal((await handleHoPlsWishRequest(req(base+p+"/x"),env())).status,404);assert.equal((await handleHoPlsWishRequest(req(base+p.replace("item-preview","item-record"),"POST","valid",{}),env())).status,405);assert.equal((await handleHoPlsWishRequest(req(base+p.replace("item-preview","item-record")),env({founder:false}))).status,403);assert.equal(calls.length,3);
});
test("HO Wish bounded exact private dispatch and no-store",async()=>{
 calls.length=0;
 const read=await handleHoPlsWishRequest(req(),env({manage:false}));assert.equal(read.status,200);assert.match(read.headers.get("cache-control")??"",/no-store/);
 const body={centerId:"qa",expectedDraftVersion:0};assert.equal((await handleHoPlsWishRequest(req(base+"savePolicy","POST","valid",body),env())).status,200);
 assert.deepEqual(calls,[{r:{method:"GET",path:"pinoria/pls-wish/config/policies"},token:"valid"},{r:{method:"POST",path:"pinoria/pls-wish/config/savePolicy",body},token:"valid"}]);
 assert.equal((await handleHoPlsWishRequest(req(base+"savePolicy","POST","valid",{name:"x".repeat(270000)}),env())).status,413);
 assert.equal(calls.length,2);
});
