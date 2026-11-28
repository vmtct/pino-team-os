import test from "node:test";
import assert from "node:assert/strict";
import {handleHoWorldRequest,type HoWorldEnv} from "./ho-world-handler";
const base="https://ho.staging.pinohouse.art",path="/api/ho/pinoria/worlds";
const body={key:"test-world",displayName:"Test World",worldType:"CORE",descriptionText:""};
const calls:unknown[]=[];
function env(options:{founder?:boolean;grant?:boolean;binding?:boolean;configured?:boolean}={}):HoWorldEnv {
 const {founder=true,grant=true,binding=true,configured=true}=options;
 return {APP_ENV:configured?"staging":"production",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{
 async executeWithStaffPassword(request,token){
 if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
 if(request.path==="ho/admission")return {status:founder?200:403,requestId:"qa",body:{data:{admitted:founder}}};
 assert.equal(request.path,"context");
 return {status:200,requestId:"qa",body:{data:{userId:founder?"founder":"manager",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:grant?["team.bo.access","pinoria.world.view","pinoria.world.manage"]:["team.bo.access"]}}};
 }},...(binding?{PINO_HO_WORLD_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:r.method==="POST"?201:200,requestId:"world-qa",body:{data:{}}}}}}:{})};
}
function req(method="GET",url=base+path,token="valid",b:unknown=undefined,key="create-qa-1"){return new Request(url,{method,headers:{host:new URL(url).hostname,cookie:"pino_staff_password_session="+token,"content-type":"application/json","idempotency-key":key},body:b===undefined?undefined:JSON.stringify(b)});}
test("exact staging HO catalog path and GET/POST only",async()=>{calls.length=0;for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal((await handleHoWorldRequest(req("GET","https://"+host+path),env())).status,404);for(const suffix of ["/x","/media","?x=1"])assert.equal((await handleHoWorldRequest(req("GET",base+path+suffix),env())).status,404);for(const m of ["PATCH","DELETE","PUT"])assert.equal((await handleHoWorldRequest(req(m),env())).status,405);assert.equal(calls.length,0);});
test("Founder, session, global action permission and private binding fail closed",async()=>{calls.length=0;for(const options of [{founder:false},{grant:false},{configured:false},{binding:false}])assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",body),env(options))).status,options.configured===false?404:options.binding===false?503:403);assert.equal((await handleHoWorldRequest(req("GET",base+path,"expired"),env())).status,401);assert.equal(calls.length,0);});
test("valid read and create use bounded exact private RPC",async()=>{calls.length=0;assert.equal((await handleHoWorldRequest(req(),env())).status,200);const r=await handleHoWorldRequest(req("POST",base+path,"valid",body),env());assert.equal(r.status,201);assert.equal(r.headers.get("x-request-id"),"world-qa");assert.deepEqual(calls,[{r:{method:"GET",path:"pinoria/worlds"},token:"valid"},{r:{method:"POST",path:"pinoria/worlds",body,idempotencyKey:"create-qa-1"},token:"valid"}]);});
test("missing key, malformed/oversize and overposted values never reach Core",async()=>{calls.length=0;assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",body,""),env())).status,400);assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",{...body,status:"ACTIVE"}),env())).status,400);assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",{...body,displayName:"a".repeat(5000)}),env())).status,413);assert.equal(calls.length,0);});

test("PAP-2143 exact nested routes, method and session fence",async()=>{
 calls.length=0;const id="019a0000-0000-7000-8000-000000000001";
 const patch={expectedVersion:1,displayName:"New"},scene={expectedWorldVersion:1,key:"scene",displayName:"Scene",canvasWidth:1920,canvasHeight:1080,baseAssetKey:"pinoria/world/uploads/"+"a".repeat(64)+".png"},save={expectedVersion:1,expectedLayers:[],layers:[]};
 for(const [method,suffix,payload,expected] of [["PATCH","/"+id,patch,200],["POST","/"+id+"/scenes",scene,201],["PUT","/scenes/"+id+"/save",save,200]] as const){
  const request=req(method,base+path+suffix,"valid",payload);
  assert.equal((await handleHoWorldRequest(request,env())).status,expected);
  assert.equal((await handleHoWorldRequest(req(method,base+path+suffix,"valid",payload),env({founder:false}))).status,403);
 }
 assert.deepEqual(calls,[{r:{method:"PATCH",path:"pinoria/worlds/"+id,body:patch},token:"valid"},{r:{method:"POST",path:"pinoria/worlds/"+id+"/scenes",body:scene,idempotencyKey:"create-qa-1"},token:"valid"},{r:{method:"PUT",path:"pinoria/worlds/scenes/"+id+"/save",body:save,idempotencyKey:"create-qa-1"},token:"valid"}]);
 calls.length=0;
 for(const [method,suffix] of [["PUT","/"+id],["PATCH","/scenes/"+id+"/save"],["POST","/not-an-id/scenes"],["POST","/"+id+"/scenes/extra"],["DELETE","/"+id],["PUT","/instances/"+id+"/save"]])assert.equal((await handleHoWorldRequest(req(method,base+path+suffix,"valid",{}),env())).status,404);
 assert.equal((await handleHoWorldRequest(req("PUT",base+path+"/scenes/"+id+"/save","valid",{...save,unknown:true}),env())).status,400);
 assert.equal((await handleHoWorldRequest(req("PUT",base+path+"/scenes/"+id+"/save","valid",{...save,descriptionText:"a".repeat(70000)}),env())).status,413);
 assert.equal(calls.length,0);
});
test("PAP-2143 bounded private multipart, raw bytes and replay key; reject extras/oversize",async()=>{
 calls.length=0;
 const make=(extra=false,size=3)=>{const f=new FormData();f.set("file",new File([new Uint8Array(size)],"motion.gif",{type:"image/gif"}));if(extra)f.set("extra","bad");return new Request(base+path+"/media",{method:"POST",headers:{host:"ho.staging.pinohouse.art",cookie:"pino_staff_password_session=valid","idempotency-key":"upload-key"},body:f})};
 assert.equal((await handleHoWorldRequest(make(),env())).status,201);
 assert.deepEqual(calls,[{r:{method:"POST",path:"pinoria/worlds/media",body:{fileName:"motion.gif",mimeType:"image/gif",bytes:new Uint8Array(3).buffer},idempotencyKey:"upload-key"},token:"valid"}]);
 calls.length=0;assert.equal((await handleHoWorldRequest(make(true),env())).status,400);
 const oversized=new Request(base+path+"/media",{method:"POST",headers:{host:"ho.staging.pinohouse.art",cookie:"pino_staff_password_session=valid","idempotency-key":"upload-key","content-type":"multipart/form-data; boundary=qa"},body:new Uint8Array(8*1024*1024+8193)});assert.equal((await handleHoWorldRequest(oversized,env())).status,413);
 assert.equal((await handleHoWorldRequest(make(),env({founder:false}))).status,403);
 assert.equal(calls.length,0);
});
test("PAP-2165 exact GET history only, Founder view required",async()=>{
 calls.length=0;const id="019a0000-0000-7000-8000-000000000001",url=base+path+"/"+id+"/history";
 assert.equal((await handleHoWorldRequest(req("GET",url),env())).status,200);
 assert.deepEqual(calls,[{r:{method:"GET",path:"pinoria/worlds/"+id+"/history"},token:"valid"}]);calls.length=0;
 for(const m of ["POST","PATCH","PUT","DELETE"])assert.equal((await handleHoWorldRequest(req(m,url),env())).status,404);
 for(const options of [{founder:false},{grant:false}])assert.equal((await handleHoWorldRequest(req("GET",url),env(options))).status,403);
 assert.equal((await handleHoWorldRequest(req("GET",url+"?limit=1000"),env())).status,404);assert.equal(calls.length,0);
});

test("PAP-2143 activation facade forwards only exact ACTIVE CAS intent with existing authorization",async()=>{
 calls.length=0;const id="019a0000-0000-7000-8000-000000000001",url=base+path+"/"+id,activation={expectedVersion:3,status:"ACTIVE"};
 assert.equal((await handleHoWorldRequest(req("PATCH",url,"valid",activation),env())).status,200);
 assert.deepEqual(calls,[{r:{method:"PATCH",path:"pinoria/worlds/"+id,body:activation},token:"valid"}]);
 calls.length=0;
 for(const invalid of [{status:"ACTIVE"},{expectedVersion:0,status:"ACTIVE"},{expectedVersion:1.5,status:"ACTIVE"},{expectedVersion:"3",status:"ACTIVE"},{expectedVersion:3,status:"ARCHIVED"},{expectedVersion:3,status:"DRAFT"},{...activation,displayName:"extra"},{...activation,unknown:true}]){
  assert.equal((await handleHoWorldRequest(req("PATCH",url,"valid",invalid),env())).status,400);
 }
 assert.equal((await handleHoWorldRequest(req("PATCH",url,"valid",activation),env({founder:false}))).status,403);
 assert.equal((await handleHoWorldRequest(req("PATCH",url,"valid",activation),env({grant:false}))).status,403);
 assert.equal((await handleHoWorldRequest(req("PATCH",url,"expired",activation),env())).status,401);
 assert.equal((await handleHoWorldRequest(req("PATCH",url,"valid",activation),env({binding:false}))).status,503);
 assert.equal(calls.length,0);
});
