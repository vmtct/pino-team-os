/** PAP-1385 / PNR-TV: Founder HO visibility ingress G0/G2 security contract. */
import assert from "node:assert/strict";
import test from "node:test";
import {BO_STAGING_HOSTNAME,HO_STAGING_HOSTNAME,decideHostBoundary} from "./host-boundary";
import {isHoTvVisibilityRequest,hoTvVisibilityGet,hoTvVisibilityPatch,InvalidTvVisibilityInput} from "./ho-tv-visibility-contract";
import {handleHoTvVisibility,type HoTvVisibilityEnv} from "./ho-tv-visibility-facade";
const c1="019b1126-0001-7000-8000-000000000001";
const c2="019b1126-0001-7000-8000-000000000002";
const policy="tvp1-default";
const prefix="/api/ho/pinoria/tv-policies/visibility/";
const route=prefix+policy;
const host=HO_STAGING_HOSTNAME;
const calls:Array<{method:string;path:string;body:unknown;token:string}>=[];
function env(options:{founder?:boolean;configured?:boolean;binding?:boolean;status?:number}={}):HoTvVisibilityEnv{
  const {founder=true,configured=true,binding=true,status=200}=options;
  return {
    APP_ENV:configured?"staging":"production",HO_PILOT_FOUNDER_USER_IDS:"founder",
    PINO_BO_CORE:{async executeWithStaffPassword(request,token){
      if(token!=="valid")return {status:401,requestId:"auth",body:{error:{code:"AUTH_REQUIRED"}}};
      if(request.path==="context")return {status:200,requestId:"ctx",body:{data:{
        userId:founder?"founder":"manager",email:"synthetic@example.invalid",
        surface:"BO",entitled:true,permissionKeys:["team.bo.access"]}}};
      assert.equal(request.path,"ho/admission");
      return {status:founder?200:403,requestId:"founder",body:{data:{admitted:founder}}};
    }},
    ...(binding?{PINO_CORE:{async executeWithStaffPassword(request,token){
      calls.push({method:request.method,path:request.path,body:request.body,token});
      return {status,requestId:"core-visibility",
        body:status===200?{data:{id:policy,revision:1,name:"PINO TV"}}:{error:{code:status===409?"CONFLICT":"ACCESS_PERMISSION_DENIED"}}};
    }}}:{}),
  };
}
function request(path:string,options:{host?:string;method?:string;body?:unknown;anonymous?:boolean;contentType?:string}={}):Request{
  const h=options.host??host,m=options.method??"GET";
  return new Request("https://"+h+path,{
    method:m,headers:{host:h,...(options.anonymous?{}:{cookie:"pino_staff_password_session=valid"}),
      ...(m==="PATCH"?{"content-type":options.contentType??"application/json"}:{})},
    ...(m==="PATCH"?{body:typeof options.body==="string"?options.body:JSON.stringify(options.body)}:{}),
  });
}
const draft={selectedCenterId:c1,name:"PINO TV",scope:"CENTER",assignedCenterIds:[c1,c2],expectedRevision:0};
test("PAP-1385 exact Founder HO Staging host and GET/PATCH paths; no wildcard or Viewer",()=>{
  for(const p of [route,prefix+"tvp1-center-"+c1]){
    for(const m of ["GET","PATCH"]){
      assert.equal(isHoTvVisibilityRequest(p,m),true);
      assert.equal(decideHostBoundary(host,p,m).action,"next");
      for(const h of [BO_STAGING_HOSTNAME,"ho.pinohouse.art","tos.staging.pinohouse.art","example.invalid"])
        assert.equal(decideHostBoundary(h,p,m).action,"not_found");
    }
    for(const m of ["POST","PUT","DELETE","HEAD","OPTIONS"])
      assert.equal(decideHostBoundary(host,p,m).action,"not_found");
  }
  for(const p of [prefix,prefix+"bogus",prefix+"tvp1-center-wrong",
    route+"/extra",prefix+"tvp1-center-"+c1+"/publish",prefix+"tvp1-default/"]) {
    for(const m of ["GET","PATCH"])assert.equal(decideHostBoundary(host,p,m).action,"not_found",p);
  }
});
test("PAP-1385 strict GET selectedCenter and PATCH CAS draft shape",()=>{
  assert.deepEqual(hoTvVisibilityGet(new URL("https://"+host+route+"?selectedCenterId="+c1)),{selectedCenterId:c1});
  assert.deepEqual(hoTvVisibilityPatch(new URL("https://"+host+route),draft),draft);
  for(const q of ["","?debug=true","?selectedCenterId=no","?selectedCenterId="+c1+"&selectedCenterId="+c2,
    "?selectedCenterId="+c1+"&debug=true"])
    assert.throws(()=>hoTvVisibilityGet(new URL("https://"+host+route+q)),InvalidTvVisibilityInput);
  for(const bad of [
    {...draft,extra:true},{...draft,selectedCenterId:"bad"},{...draft,name:" TV "},
    {...draft,name:""},{...draft,scope:"OTHER"},{...draft,assignedCenterIds:[c1,c1]},
    {...draft,scope:"DEFAULT"},{...draft,expectedRevision:-1},{...draft,expectedRevision:1.5},
    {...draft,assignedCenterIds:["wrong"]},{...draft,assignedCenterIds:[] ,expectedRevision:null},
  ])assert.throws(()=>hoTvVisibilityPatch(new URL("https://"+host+route),bad),InvalidTvVisibilityInput);
});
test("PAP-1385 authenticated Founder GET forwards selectedCenter only and no-store",async()=>{
  calls.length=0;
  const ok=await handleHoTvVisibility(request(route+"?selectedCenterId="+c1),env());
  assert.equal(ok.status,200);assert.equal(ok.headers.get("cache-control"),"no-store");
  assert.equal(ok.headers.get("x-request-id"),"core-visibility");
  assert.deepEqual(calls,[{method:"GET",path:"pinoria/tv-policies/visibility/"+policy,
    body:{selectedCenterId:c1},token:"valid"}]);
});
test("PAP-1385 Founder PATCH forwards CAS payload; Core conflict/deny unchanged",async()=>{
  calls.length=0;
  const ok=await handleHoTvVisibility(request(route,{method:"PATCH",body:draft}),env());
  assert.equal(ok.status,200);
  assert.deepEqual(calls,[{method:"PATCH",path:"pinoria/tv-policies/visibility/"+policy,body:draft,token:"valid"}]);
  assert.equal((await handleHoTvVisibility(request(route,{method:"PATCH",body:draft}),env({status:409}))).status,409);
  assert.equal((await handleHoTvVisibility(request(route,{method:"PATCH",body:draft}),env({status:403}))).status,403);
  assert.equal(calls.length,3);
});
test("PAP-1385 anonymous/non-Founder/wrong host/method/production/invalid payload fail before Core",async()=>{
  calls.length=0;
  const get=route+"?selectedCenterId="+c1;
  assert.equal((await handleHoTvVisibility(request(get,{anonymous:true}),env())).status,401);
  assert.equal((await handleHoTvVisibility(request(get),env({founder:false}))).status,403);
  assert.equal((await handleHoTvVisibility(request(get,{host:BO_STAGING_HOSTNAME}),env())).status,404);
  assert.equal((await handleHoTvVisibility(request(get),env({configured:false}))).status,404);
  assert.equal((await handleHoTvVisibility(request(get,{method:"DELETE"}),env())).status,404);
  assert.equal((await handleHoTvVisibility(request(get),env({binding:false}))).status,503);
  assert.equal((await handleHoTvVisibility(request(route+"?debug=true"),env())).status,400);
  assert.equal((await handleHoTvVisibility(request(route,{method:"PATCH",body:{...draft,expectedRevision:-1}}),env())).status,400);
  assert.equal((await handleHoTvVisibility(request(route,{method:"PATCH",body:"{broken"}),env())).status,400);
  assert.equal((await handleHoTvVisibility(request(route,{method:"PATCH",body:draft,contentType:"text/plain"}),env())).status,400);
  assert.deepEqual(calls,[]);
});
