import test from "node:test";
import assert from "node:assert/strict";
import { HO_STAGING_HOSTNAME, BO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { handleHoPinoriaItemRequest, type HoItemEnv } from "./ho-pinoria-item-handler";

const id="019b1126-0001-7000-8000-000000000001";
const host=HO_STAGING_HOSTNAME;
const base="https://"+host;
const path="/api/ho/pinoria/items";
const forwarded:Array<{method:string;path:string;token:string;body:unknown;idempotencyKey:string|undefined}>=[];
function env(options:{founder?:boolean;grant?:boolean;binding?:boolean;configured?:boolean}={}):HoItemEnv {
  const {founder=true,grant=true,binding=true,configured=true}=options;
  return {
    APP_ENV:configured?"staging":"production",
    HO_PILOT_FOUNDER_USER_IDS:"founder",
    PINO_BO_CORE:{
      async executeWithStaffPassword(request,token){
        if(token!=="valid")return {status:401,requestId:"ctx-auth",body:{error:{code:"AUTH_REQUIRED"}}};
        assert.equal(request.path,"context");
        return {status:200,requestId:"ctx-ok",body:{data:{userId:founder?"founder":"manager",email:"actor@example.invalid",surface:"BO",entitled:true,permissionKeys:grant?["team.bo.access","pinoria.item.view","pinoria.item.manage"]:["team.bo.access"]}}};
      }
    },
    ...(binding?{PINO_HO_ITEM_CORE:{
      async executeWithStaffPassword(request,token){
        forwarded.push({method:request.method,path:request.path,body:request.body,token,idempotencyKey:request.idempotencyKey});
        return {status:200,requestId:"ho-item",body:{data:{id}}};
      }
    }}:{})
  };
}
function req(url:string,method="GET",token="valid",body?:unknown) {
  return new Request(url,{method,headers:{host:new URL(url).hostname,cookie:"pino_staff_password_session="+token,"content-type":"application/json","idempotency-key":"pap1126-test"},body:body===undefined?undefined:JSON.stringify(body)});
}
test("PAP-1126 HO route admission is exact and never available on BO/TOS/prod",()=>{
  const allowed=[["GET",path],["POST",path],["POST",path+"/uploads"],["GET",path+"/"+id],["PATCH",path+"/"+id],["POST",path+"/"+id+"/publish"],["POST",path+"/"+id+"/unpublish"]] as const;
  for(const [verb,p] of allowed)assert.equal(decideHostBoundary(host,p,verb).action,"next",verb+" "+p);
  for(const [verb,p] of [["PUT",path],["DELETE",path],["POST",path+"/malformed"],["POST",path+"/"+id+"/asset"],["GET",path+"/uploads"],["PATCH",path+"/uploads"]] as const)assert.equal(decideHostBoundary(host,p,verb).action,"not_found",verb+" "+p);
  for(const other of [BO_STAGING_HOSTNAME,"bo.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","pino-team-os.minhtri-van42.workers.dev"]){
    assert.equal(decideHostBoundary(other,path,"POST").action,"not_found",other);
  }
});
test("HO Founder session and explicit new Item permission are both required",async()=>{
  forwarded.length=0;
  for(const options of [{founder:false},{grant:false},{configured:false}]){
    const response=await handleHoPinoriaItemRequest(req(base+path,"POST","valid",{hello:"world"}),env(options));
    assert.equal(response.status,options.configured===false?404:403);
  }
  assert.equal((await handleHoPinoriaItemRequest(req(base+path,"POST","missing",{hello:"world"}),env())).status,401);
  assert.equal(forwarded.length,0);
  assert.equal((await handleHoPinoriaItemRequest(req("https://"+BO_STAGING_HOSTNAME+path,"POST","valid",{}),env())).status,404);
  assert.equal((await handleHoPinoriaItemRequest(req(base+path,"POST","valid",{}),env({binding:false}))).status,503);
});
test("HO Item private binding receives bounded path, credential and idempotency key",async()=>{
  forwarded.length=0;
  const body={type:"WEARABLE",slot:"HAIR",expectedRevision:1};
  const response=await handleHoPinoriaItemRequest(req(base+path+"/"+id,"PATCH","valid",body),env());
  assert.equal(response.status,200);
  assert.equal(response.headers.get("x-request-id"),"ho-item");
  assert.deepEqual(forwarded,[{method:"PATCH",path:"pinoria/items/"+id,body,token:"valid",idempotencyKey:"pap1126-test"}]);
});
test("HO Item API returns HTTP 400 for malformed JSON and invalid media instead of leaking a 503",async()=>{
  forwarded.length=0;
  const jsonHeaders={host,cookie:"pino_staff_password_session=valid","content-type":"application/json"};
  const malformed=new Request(base+path,{method:"POST",headers:jsonHeaders,body:"{"});
  assert.equal((await handleHoPinoriaItemRequest(malformed,env())).status,400);
  const invalidImage=req(base+path+"/uploads","POST","valid",{fileName:"bad.png",mimeType:"image/png",bytesBase64:"not base64"});
  assert.equal((await handleHoPinoriaItemRequest(invalidImage,env())).status,400);
  assert.equal(forwarded.length,0);
});
test("HO private Item handler rejects untrusted verbs and malformed host before Core",async()=>{
  forwarded.length=0;
  const urls=[base+path+"/../../access/users",base+path+"/"+id+"/unpublish/hijack"];
  for(const url of urls)assert.equal((await handleHoPinoriaItemRequest(req(url,"GET"),env())).status,404);
  assert.equal((await handleHoPinoriaItemRequest(req(base+path,"DELETE"),env())).status,405);
  assert.equal(forwarded.length,0);
});
