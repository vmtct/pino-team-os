/** PAP-1418 / PNR-TV: exact HO TV read BFF, Founder ACL and Core status truth. */
import assert from "node:assert/strict";
import test from "node:test";
import {BO_STAGING_HOSTNAME,HO_STAGING_HOSTNAME,decideHostBoundary} from "./host-boundary";
import {isHoTvReadRequest,parseHoTvRead,InvalidTvReadQuery} from "./ho-tv-read-contract";
import {handleHoTvRead,type HoTvReadEnv} from "./ho-tv-read-facade";
const c1="019b1126-0001-7000-8000-000000000001";
const v1="019b1126-0001-7000-8000-000000000002";
const host=HO_STAGING_HOSTNAME,base="https://"+host;
const prefix="/api/ho/pinoria/";
const records:Array<{path:string;body:unknown;token:string}>=[];
function env({founder=true,configured=true,binding=true,coreStatus=200}:
  {founder?:boolean;configured?:boolean;binding?:boolean;coreStatus?:number}={}):HoTvReadEnv{
  return {
    APP_ENV:configured?"staging":"production",
    HO_PILOT_FOUNDER_USER_IDS:"founder",
    PINO_BO_CORE:{
      async executeWithStaffPassword(request,token){
        if(token!=="valid")return {status:401,requestId:"auth",body:{error:{code:"AUTH_REQUIRED"}}};
        if(request.path==="context")return {status:200,requestId:"ctx",body:{data:{
          userId:founder?"founder":"manager",email:"synthetic@example.invalid",
          surface:"BO",entitled:true,permissionKeys:["team.bo.access"]}}};
        assert.equal(request.path,"ho/admission");
        return {status:founder?200:403,requestId:"founder",body:{data:{admitted:founder}}};
      },
    },
    ...(binding?{PINO_CORE:{
      async executeWithStaffPassword(request,token){
        records.push({path:request.path,body:request.body,token});
        return {status:coreStatus,requestId:"core-tv-id",
          body:coreStatus===200?{data:{source:"CORE",rendererAcknowledged:false}}:{error:{code:"ACCESS_PERMISSION_DENIED"}}};
      },
    }}:{}),
  };
}
function req(path:string,options:{host?:string;method?:string;token?:string}={}):Request{
  const h=options.host??host;
  return new Request("https://"+h+path,{
    method:options.method??"GET",
    headers:{host:h,...(options.token==="absent"?{}:{cookie:"pino_staff_password_session="+(options.token??"valid")})},
  });
}
test("PAP-1418 exact HO host/GET route allowlist has no BO, write, or wildcard aperture",()=>{
  const urls=[
    prefix+"tv-health/displays",prefix+"tv-health/devices",prefix+"tv-health/operator-health",
    prefix+"tv-config/spatial/head",prefix+"tv-config/dialogue/versions",
    prefix+"tv-config/policy/version",prefix+"tv-config/policy/active",
  ];
  for(const url of urls){
    assert.equal(isHoTvReadRequest(url,"GET"),true,url);
    assert.equal(decideHostBoundary(host,url,"GET").action,"next",url);
    for(const method of ["POST","PUT","PATCH","DELETE","HEAD","OPTIONS"])
      assert.equal(decideHostBoundary(host,url,method).action,"not_found",url+method);
    for(const h of [BO_STAGING_HOSTNAME,"ho.pinohouse.art","tos.staging.pinohouse.art","example.invalid"])
      assert.equal(decideHostBoundary(h,url,"GET").action,"not_found",h+url);
  }
  for(const url of [prefix+"tv-health",prefix+"tv-health/bogus",prefix+"tv-config/spatial/publish",
    prefix+"tv-config/spatial/head/extra",prefix+"tv-config/ads/head",prefix+"tv-health/devices/"])
    assert.equal(decideHostBoundary(host,url,"GET").action,"not_found",url);
});
test("Core read-body parser accepts only exact scope and canonical Center/version",()=>{
  const get=(path:string)=>parseHoTvRead(new URL(base+path));
  assert.deepEqual(get(prefix+"tv-health/displays"),{path:"pinoria/tv-health/displays",body:{}});
  assert.deepEqual(get(prefix+"tv-health/operator-health?centerId="+c1),{
    path:"pinoria/tv-health/operator-health",body:{centerId:c1}});
  assert.deepEqual(get(prefix+"tv-config/spatial/head?scope=DEFAULT"),{
    path:"pinoria/tv-config/spatial/head",body:{scope:{kind:"DEFAULT"}}});
  assert.deepEqual(get(prefix+"tv-config/dialogue/version?scope=CENTER&centerId="+c1+"&versionId="+v1),{
    path:"pinoria/tv-config/dialogue/version",body:{scope:{kind:"CENTER",centerId:c1},versionId:v1}});
  for(const url of [
    prefix+"tv-health/displays?debug=true",
    prefix+"tv-health/operator-health?centerId="+c1+"&centerId="+c1,
    prefix+"tv-health/operator-health?centerId=wrong",
    prefix+"tv-health/operator-health",
    prefix+"tv-config/spatial/head",
    prefix+"tv-config/spatial/head?scope=DEFAULT&centerId="+c1,
    prefix+"tv-config/spatial/head?scope=CENTER",
    prefix+"tv-config/spatial/active?scope=DEFAULT",
    prefix+"tv-config/policy/version?scope=CENTER&centerId="+c1+"&versionId=wrong",
  ])assert.throws(()=>get(url),InvalidTvReadQuery,url);
});
test("Founder HO password forwards only safe Core read and keeps Core 403, request ID and no-store",async()=>{
  records.length=0;
  const path=prefix+"tv-health/operator-health?centerId="+c1;
  const response=await handleHoTvRead(req(path),env());
  assert.equal(response.status,200);
  assert.equal(response.headers.get("x-request-id"),"core-tv-id");
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(records,[{path:"pinoria/tv-health/operator-health",body:{centerId:c1},token:"valid"}]);
  const forbidden=await handleHoTvRead(req(path),env({coreStatus:403}));
  assert.equal(forbidden.status,403);
  assert.deepEqual((await forbidden.json()),{error:{code:"ACCESS_PERMISSION_DENIED"}});
  assert.equal(forbidden.headers.get("x-request-id"),"core-tv-id");
});
test("HO gate blocks anonymous, non-Founder, foreign host, production and missing binding",async()=>{
  records.length=0;
  const url=prefix+"tv-health/devices";
  assert.equal((await handleHoTvRead(req(url,{token:"absent"}),env())).status,401);
  assert.equal((await handleHoTvRead(req(url),env({founder:false}))).status,403);
  assert.equal((await handleHoTvRead(req(url,{host:BO_STAGING_HOSTNAME}),env())).status,404);
  assert.equal((await handleHoTvRead(req(url),env({configured:false}))).status,404);
  assert.equal((await handleHoTvRead(req(url,{method:"POST"}),env())).status,404);
  assert.equal((await handleHoTvRead(req(url),env({binding:false}))).status,503);
  assert.equal((await handleHoTvRead(req(url+"?debug=true"),env())).status,400);
  assert.deepEqual(records,[]);
});
