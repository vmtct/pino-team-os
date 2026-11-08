/** PAP-1594: HO Path directory read-only, Founder-bound host and Core ACL. */
import assert from "node:assert/strict";
import test from "node:test";
import { BO_STAGING_HOSTNAME, HO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { handleHoPathRead, type HoPathReadEnv } from "./ho-path-read-facade";

const route = "/api/ho/learning/paths";
const base = "https://" + HO_STAGING_HOSTNAME;
const forwarded: Array<{method:string;path:string;body?:unknown}> = [];
function env(options: {founder?:boolean;available?:boolean;stage?:boolean;status?:number} = {}): HoPathReadEnv {
  const {founder=true,available=true,stage=true,status=200}=options;
  return {
    APP_ENV:stage?"staging":"production",
    HO_PILOT_FOUNDER_USER_IDS:"founder",
    PINO_BO_CORE: {
      async executeWithStaffPassword(request, token) {
        if (token!=="valid") return {status:401,requestId:"auth",body:{error:{code:"AUTH_REQUIRED"}}};
        if (request.path==="context") return {status:200,requestId:"context",body:{data:{
          userId:founder?"founder":"manager",email:"synthetic@example.invalid",surface:"BO",
          entitled:true,permissionKeys:["team.bo.access"],
        }}};
        assert.equal(request.path,"ho/admission");
        return {status:founder?200:403,requestId:"founder",body:{data:{admitted:founder}}};
      },
    },
    ...(available ? {PINO_CORE: {
      async executeWithStaffPassword(request, token) {
        assert.equal(token,"valid");
        forwarded.push({method:request.method,path:request.path,body:request.body});
        return {status,requestId:"path-read-id",body:status===200
          ? {data:{paths:[{id:"01a03c6e-cc58-78f3-aa4f-3e9b3ac2afe2",code:"artchitect",displayName:"Artchitect",status:"ACTIVE"}]}}
          : {error:{code:"ACCESS_PERMISSION_DENIED"}}};
      },
    }} : {}),
  };
}
function req(path=route,opts:{host?:string;method?:string;token?:string}={}):Request {
  const host=opts.host??HO_STAGING_HOSTNAME;
  return new Request("https://"+host+path,{method:opts.method??"GET",headers:{
    host,...(opts.token==="absent"?{}:{cookie:"pino_staff_password_session="+(opts.token??"valid")}),
  }});
}
test("PAP-1594 host fence permits only one exact HO GET, never BO, production or mutation",()=>{
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,route,"GET").action,"next");
  for(const method of ["POST","PUT","PATCH","DELETE","HEAD","OPTIONS"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,route,method).action,"not_found",method);
  for(const host of [BO_STAGING_HOSTNAME,"ho.pinohouse.art","tos.staging.pinohouse.art","unknown.invalid"])
    assert.equal(decideHostBoundary(host,route,"GET").action,"not_found",host);
  for(const path of [route+"/anything",route+"-copy"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,path,"GET").action,"not_found",path);
});
test("PAP-1594 sends exact Founder-only Core read and propagates auth/request-id/no-store",async()=>{
  forwarded.length=0;
  const ok=await handleHoPathRead(req(),env());
  assert.equal(ok.status,200);
  assert.equal(ok.headers.get("cache-control"),"no-store");
  assert.equal(ok.headers.get("x-request-id"),"path-read-id");
  assert.deepEqual(forwarded,[{method:"GET",path:"learning/paths",body:{}}]);
  assert.equal(((await ok.json()) as {data:{paths:unknown[]}}).data.paths.length,1);
  const forbidden=await handleHoPathRead(req(),env({status:403}));
  assert.equal(forbidden.status,403);
});
test("PAP-1594 fails closed for manager, no session, foreign host, prod, missing core and invalid query",async()=>{
  forwarded.length=0;
  assert.equal((await handleHoPathRead(req(route,{token:"absent"}),env())).status,401);
  assert.equal((await handleHoPathRead(req(),env({founder:false}))).status,403);
  assert.equal((await handleHoPathRead(req(route,{host:BO_STAGING_HOSTNAME}),env())).status,404);
  assert.equal((await handleHoPathRead(req(),env({stage:false}))).status,404);
  assert.equal((await handleHoPathRead(req(route,{method:"POST"}),env())).status,404);
  assert.equal((await handleHoPathRead(req(),env({available:false}))).status,503);
  assert.equal((await handleHoPathRead(req(route+"?debug=1"),env())).status,404);
  assert.deepEqual(forwarded,[]);
});
