import test from "node:test";
import assert from "node:assert/strict";
import {HO_STAGING_HOSTNAME,decideHostBoundary} from "./host-boundary";
import {parseHoSpecialtyV2ReadRequest} from "./ho-specialty-v2-read-facade";
import {parseSpecialtySummary,parseSpecialtyDetail,readSpecialtyV2List,readSpecialtyV2Detail} from "./ho-specialty-v2-reader";
import {BoApiError} from "./bo-api-error";
import {surfaceSession} from "./workspace-adapters/session";

const sid="01234567-89ab-7cde-8fab-0123456789ab",pid="11234567-89ab-7cde-8fab-0123456789ab";
const lid="21234567-89ab-7cde-8fab-0123456789ab",mid="31234567-89ab-7cde-8fab-0123456789ab";
const summary={id:sid,pathProgramId:pid,name:"Hội họa",description:null,status:"DRAFT",
 tags:["Acrylic"],version:1,missionCountDistinct:2};
const detail={...summary,prerequisiteIds:[],levels:[{id:lid,order:1,name:"Cấp 1",missionIds:[mid]}]};
const make=(path:string,options:RequestInit={})=>new Request("https://"+HO_STAGING_HOSTNAME+path,
 {headers:{host:HO_STAGING_HOSTNAME},...options});
test("PAP-1495 exact Founder GET route accepts bounded list/detail and refuses unsafe route input",()=>{
 assert.deepEqual(parseHoSpecialtyV2ReadRequest(make("/api/ho/learning/specialties?limit=100&offset=0")), {path:"learning/specialties?limit=100&offset=0"});
 assert.deepEqual(parseHoSpecialtyV2ReadRequest(make("/api/ho/learning/specialties/"+sid),sid),{path:"learning/specialties/"+sid});
 for(const path of ["/api/ho/learning/specialties?limit=101",
   "/api/ho/learning/specialties?limit=1&limit=2",
   "/api/ho/learning/specialties?pathProgramId=not-uuid",
   "/api/ho/learning/specialties?status=PUBLISHED",
   "/api/ho/learning/specialties?foo=bar"]){
  assert.equal("status" in parseHoSpecialtyV2ReadRequest(make(path)),true,path);
 }
 const write=parseHoSpecialtyV2ReadRequest(make("/api/ho/learning/specialties",{method:"POST"}));
 assert.equal("status" in write&&write.status,405);
 const foreign=new Request("https://example.org/api/ho/learning/specialties",{headers:{host:"example.org"}});
 assert.equal("status" in parseHoSpecialtyV2ReadRequest(foreign),true);
 const queryDetail=parseHoSpecialtyV2ReadRequest(make("/api/ho/learning/specialties/"+sid+"?debug=1"),sid);
 assert.equal("status" in queryDetail&&queryDetail.status,404);
});
test("PAP-1495 strict Core data decoder never guesses Catalog or completion",()=>{
 assert.deepEqual(parseSpecialtySummary(summary),summary);
 assert.deepEqual(parseSpecialtyDetail(detail),detail);
 for(const input of [null,{},[],{...summary,missionCountDistinct:"2"},{...summary,id:"legacy-specialty"},{...summary,tags:null}]){
  assert.equal(parseSpecialtySummary(input),null);
 }
 assert.equal(parseSpecialtyDetail({...detail,levels:[{...detail.levels[0],missionIds:["fake"]}]}),null);
});
test("PAP-1495 read-only facade projection paginates real 200 data and rejects 403/error/malformed envelope",async()=>{
 const signal=new AbortController().signal;
 const fetcher:typeof fetch=async input=>{
  const url=String(input);
  assert.match(url,/^\/api\/ho\/learning\/specialties\?limit=100&offset=0$/);
  return Response.json({data:[summary]});
 };
 assert.deepEqual(await readSpecialtyV2List(fetcher,signal),[summary]);
 const getter:typeof fetch=async input=>{
  assert.equal(String(input),"/api/ho/learning/specialties/"+sid);
  return Response.json({data:detail});
 };
 assert.deepEqual(await readSpecialtyV2Detail(sid,getter,signal),detail);
 const denied:typeof fetch=async()=>Response.json({error:{code:"ACCESS_DENIED"}},{status:403});
 await assert.rejects(readSpecialtyV2List(denied,signal),(e:unknown)=>e instanceof BoApiError&&e.status===403);
 const malformed:typeof fetch=async()=>Response.json({data:[{...summary,version:"1"}]});
 await assert.rejects(readSpecialtyV2List(malformed,signal),(e:unknown)=>e instanceof BoApiError&&e.status===502);
 const missingEnvelope:typeof fetch=async()=>Response.json({items:[]});
 await assert.rejects(readSpecialtyV2List(missingEnvelope,signal),(e:unknown)=>e instanceof BoApiError&&e.status===502);
});
test("PAP-1495 HO session transport admits only exact same-origin GET Catalog routes",async()=>{
 let requests=0;
 const proxy:typeof fetch=async input=>{
  requests++;assert.match(String(input),/https:\/\/ho\.staging\.pinohouse\.art\/api\/ho\/learning\/specialties/);
  return Response.json({data:[]});
 };
 const session=surfaceSession("HO","https://"+HO_STAGING_HOSTNAME,proxy);
 try{
  assert.equal((await session.transport("/api/ho/learning/specialties?limit=100&offset=0")).status,200);
  assert.equal((await session.transport("/api/ho/learning/specialties/"+sid)).status,200);
  await assert.rejects(session.transport("/api/ho/learning/specialties",{method:"POST"}),(e:unknown)=>e instanceof BoApiError&&e.status===404);
  await assert.rejects(session.transport("/api/ho/learning/specialties?unknown=1"),(e:unknown)=>e instanceof BoApiError&&e.status===404);
  await assert.rejects(session.transport("https://evil.example/api/ho/learning/specialties"),(e:unknown)=>e instanceof BoApiError&&e.status===404);
  assert.equal(requests,2);
 }finally{session.dispose();}
});
test("PAP-1495 host admission permits only HO Staging GET list and canonical detail",()=>{
 const list="/api/ho/learning/specialties",detail=list+"/"+sid;
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,list,"GET").action,"next");
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,detail,"GET").action,"next");
 for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"]){
  assert.equal(decideHostBoundary(host,list,"GET").action,"not_found");
  assert.equal(decideHostBoundary(host,detail,"GET").action,"not_found");
 }
 for(const [path,method] of [[detail,"PUT"],[list+"/unknown","GET"],[list+"/path-options","POST"]]){
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,path,method).action,"not_found");
 }
});
