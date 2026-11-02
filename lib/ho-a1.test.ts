import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary,HO_STAGING_HOSTNAME } from "./host-boundary";
import {hoAccessReadAllowed} from "./ho-access-guard";
import {validateHoA1Query} from "./ho-a1-query";
import {HO_A1_KEYS, hoA1Modules,hoA1Routes,loadHoA1,mapHoEffects,mapHoMissions,mapHoSyllabi,mapHoWorlds,mapHoWardrobe,mapHoWardSets} from "./ho-a1";
import {handleBoOperationalReadRequest} from "./bo-read-handler";
import type {HoEnv} from "./ho-auth";

const HO=HO_STAGING_HOSTNAME;
const reads=["learning/syllabi","learning/syllabi/owners","learning/missions","pinoria/worlds","pinoria/ward/catalog","pinoria/ward/sets","pinoria/effects/catalog"];
const pages=Object.values(hoA1Routes);
test("Six distinct A1 HO routes and read-only DS fields",()=>{
 assert.equal(HO_A1_KEYS.length,6);assert.equal(new Set(pages).size,6);
 for(const k of HO_A1_KEYS){
  assert.ok(hoA1Routes[k].startsWith("/ho/"));
  assert.ok(hoA1Modules[k].fields.length>=5);
  assert.ok(hoA1Modules[k].fields.every(f=>f.readonly===true));
  assert.equal(decideHostBoundary(HO,hoA1Routes[k],"GET").action,"next");
  assert.equal(decideHostBoundary("bo.staging.pinohouse.art",hoA1Routes[k],"GET").action,"not_found");
  assert.equal(decideHostBoundary("tos.staging.pinohouse.art",hoA1Routes[k],"GET").action,"not_found");
  assert.equal(decideHostBoundary("ho.pinohouse.art",hoA1Routes[k],"GET").action,"not_found");
  assert.equal(decideHostBoundary("pino-team-os-staging.minhtri-van42.workers.dev",hoA1Routes[k],"GET").action,"not_found");
 }
});
test("HO only allows exact canonical A1 GETs and rejects all mutation paths",()=>{
 for(const p of reads){
  assert.equal(hoAccessReadAllowed(p),true,p);
  assert.equal(decideHostBoundary(HO,"/api/bo/"+p,"GET").action,"next",p);
  for(const method of ["HEAD","POST","PUT","PATCH","DELETE"]){
   assert.equal(decideHostBoundary(HO,"/api/bo/"+p,method).action,"not_found",method+" "+p);
  }
 }
 const blocked=["pinoria/worlds/instances","pinoria/worlds/learners","pinoria/worlds/media","pinoria/ward/catalog/items","pinoria/ward/catalog/variants","pinoria/ward/set-webm-assets","pinoria/ward/sets/media","learning/syllabi/media","learning/syllabi/123/publish","learning/missions/foo/create","access/assignments","pinoria/tv-config/policy/head"];
 for(const p of blocked){
  assert.equal(hoAccessReadAllowed(p),false,p);
  assert.equal(decideHostBoundary(HO,"/api/bo/"+p,"GET").action,"not_found",p);
 }
 for(const p of ["/api/founder/pinoria/wish/catalog","/api/bo/learning/missions/xx","/api/bo/learning/syllabi/hello"]){
  assert.equal(decideHostBoundary(HO,p,"GET").action,"not_found",p);
 }
});
test("Bounded and unambiguous HO Mission query",()=>{
 for(const qs of ["limit=0","limit=101","limit=5&limit=5","offset=-1","offset=1000001","level=6","status=BAD","query=secret","centerId=someone","ownerId=x","search="+"a".repeat(122)]){
  assert.throws(()=>validateHoA1Query("learning/missions",new URLSearchParams(qs)),qs);
 }
 assert.doesNotThrow(()=>validateHoA1Query("learning/missions",new URLSearchParams("limit=50&offset=50&status=ACTIVE&level=1")));
 assert.throws(()=>validateHoA1Query("pinoria/worlds",new URLSearchParams("includeInstances=true")));
 assert.doesNotThrow(()=>validateHoA1Query("pinoria/worlds",new URLSearchParams()));
 assert.throws(()=>validateHoA1Query("learning/syllabi",new URLSearchParams("ownerType=HOUSE_PATH")));
 assert.doesNotThrow(()=>validateHoA1Query("learning/syllabi",new URLSearchParams("ownerType=HOUSE_PATH&ownerId=foo")));
});
const cid="0198d050-56c1-7ac5-b9ab-b0e45d912345";
function env(permitted=true,principal="founder"):HoEnv&{PINO_BO_CORE:any}{
 return {APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{
  async executeWithStaffPassword(request:{path:string},token:string){
   if(token!=="valid")return {status:401,requestId:"auth",body:{}};
   if(request.path==="context")return {status:200,requestId:"context",body:{data:{userId:principal,email:"user@example.invalid",surface:"BO",entitled:true}}};
   if(!permitted)return {status:403,requestId:"denied",body:{error:{code:"ACCESS_PERMISSION_DENIED"}}};
   return {status:200,requestId:"read",body:{data:[]}};
  },
 }};
}
const req=(path:string,credential="valid")=>new Request("https://"+HO+"/api/bo/"+path,{headers:{host:HO,cookie:"pino_staff_password_session="+credential}});
test("Each A1 source still requires authenticated Founder pilot AND live Core permission",async()=>{
 for(const p of reads){
  const ok=await handleBoOperationalReadRequest(req(p),env(),p);
  assert.equal(ok.status,200,p);
  assert.equal(ok.headers.get("cache-control"),"no-store");
  assert.equal((await handleBoOperationalReadRequest(req(p),env(true,"ordinary-user"),p)).status,403,p);
  assert.equal((await handleBoOperationalReadRequest(req(p),env(false),p)).status,403,p);
  assert.equal((await handleBoOperationalReadRequest(req(p,"invalid"),env(),p)).status,401,p);
 }
});
test("List mapper projects required fields but excludes raw arbitrary metadata",()=>{
 const w=mapHoWorlds({worlds:[{id:cid,key:"W",displayName:"World",worldType:"CORE",status:"ACTIVE",metadata:{secret:"never-output"},scenes:[{displayName:"Scene A",status:"ACTIVE",layers:[{displayName:"Layer B",kind:"MEDIA",mediaType:"PNG",metadata:{secret:"no"}}]}]}]});
 assert.equal(w[0]?.sceneCount,1);assert.equal(w[0]?.layerCount,1);assert.equal(JSON.stringify(w).includes("never-output"),false);
 const c=mapHoWardrobe({items:[{id:cid,displayName:"Hat",key:"hat",status:"ACTIVE",itemType:"WEARABLE",rarityStars:3,tags:["h"],metadata:{secret:"never-output"}}],variants:[{wearableId:cid,displayName:"Blue",renderMode:"LAYER",assetKey:"pino/asset"}]});
 assert.equal((c[0]?.variants as string[]).length,1);assert.equal(JSON.stringify(c).includes("never-output"),false);
 assert.equal(mapHoWardSets({sets:[{id:cid,displayName:"Set",memberCount:1,members:[{itemName:"Hat",variantName:"Blue"}]}]})[0]?.memberCount,1);
 assert.equal(mapHoEffects([{key:"glow",displayName:"Glow",capabilities:["pulse"],description:"safe"}])[0]?.id,"glow");
 assert.equal(mapHoMissions([{id:cid,name:"Mission",code:"M-1",plsValue:25,diagnostics:["READY"],metadata:{password:"hidden"}}])[0]?.plsValue,25);
});
test("Syllabus maps canonical owner and version lineage",()=>{
 const syllabus={id:cid,code:"SL-1",owner:{type:"HOUSE_PATH",id:"path-1"},lifecycle:"ACTIVE",createdAt:"2026-10-26T00:00:00Z"};
 const s=mapHoSyllabi([{syllabus,currentDraftVersionNumber:2,latestPublishedVersionNumber:1,latestPublishedTitle:"Art"}] as never, {housePaths:[{id:"path-1",displayName:"Art",code:"A",status:"active"}],houseCurricula:[],toppiPrograms:[]} as never,
 [{syllabus,versions:[{versionNumber:1,state:"PUBLISHED",title:"Art"}],currentDraft:{title:"Draft"}}] as never);
 assert.equal(s[0]?.owner,"Art");assert.deepEqual(s[0]?.versions,["v1 · PUBLISHED · Art"]);
});
test("Missions fetch all pages with no hidden 50-row truncation",async()=>{
 const calls:string[]=[];
 const f=async(input:RequestInfo|URL)=>{const url=String(input);calls.push(url);
  const offset=Number(new URL(url,"https://example.invalid").searchParams.get("offset"));
  const data=Array.from({length:offset===0?50:1},(_,i)=>({id:String(offset+i),name:"Mission "+(offset+i),code:"M-"+i}));
  return Response.json({data});
 };
 const rows=await loadHoA1("missions",f as typeof fetch);
 assert.equal(rows.length,51);assert.equal(calls.length,2);assert.ok(calls[1].includes("offset=50"));
});
test("No data is an honest empty state, malformed data fails closed",async()=>{
 const f=async()=>Response.json({data:{worlds:[]}});
 assert.deepEqual(await loadHoA1("worlds",f as typeof fetch),[]);
 await assert.rejects(()=>loadHoA1("worlds",(async()=>Response.json({data:[123]})) as typeof fetch));
 await assert.rejects(()=>loadHoA1("missions",(async()=>Response.json({error:{message:"No scope"}},{status:403})) as typeof fetch));
});
