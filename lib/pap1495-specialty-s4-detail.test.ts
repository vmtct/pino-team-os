import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { specialtyProvider,specialtyFields,specialtyPrerequisiteLabels } from "../app/ho/learning/specialties/schema";
import { loadSpecialtyS4Read } from "./ho-specialty-s4-read";
import type { SpecialtyV2Summary } from "./ho-specialty-v2-reader";
import { SpecialtyMissionsReadContent } from "../app/ho/learning/specialties/HoSpecialtyMissionsRead";

const id="01234567-89ab-7cde-8fab-0123456789ab",
  path="11234567-89ab-7cde-8fab-0123456789ab",
  prereq="21234567-89ab-7cde-8fab-0123456789ab",
  missionId="31234567-89ab-7cde-8fab-0123456789ab",
  levelId="41234567-89ab-7cde-8fab-0123456789ab";
const summary:SpecialtyV2Summary={id,pathProgramId:path,name:"Anime",description:null,status:"DRAFT",
  tags:["Anime"],version:1,missionCountDistinct:0};
const detail={...summary,prerequisiteIds:[],levels:[]};
const options=["little-piner-art","little-piner-piano","artchitect","pianohouse"].map((code,i)=>
  ({id:i===0?path:(i+5)+"1234567-89ab-7cde-8fab-0123456789ab",code,label:code}));
const ac=()=>new AbortController().signal;

test("PAP-1495 (PAP-1491) S4: canonical prerequisite names, fail closed on orphan UUID",async()=>{
 assert.equal(specialtyFields.find(f=>f.key==="prerequisiteView")?.type,"multirelation");
 assert.deepEqual(specialtyPrerequisiteLabels([prereq],[{...summary,id:prereq,name:"Gouache"}]),["Gouache"]);
 assert.throws(()=>specialtyPrerequisiteLabels([prereq],[summary]),{status:502});
 const fetcher:typeof fetch=async u=>{
  const x=String(u);
  if(x.includes("path-options"))return Response.json({data:options});
  if(x.includes("/api/ho/learning/specialties?"))return Response.json({data:[summary,{...summary,id:prereq,name:"Gouache"}]});
  return Response.json({data:{...detail,prerequisiteIds:[prereq]}});
 };
 const result=await specialtyProvider.detail(id,{surface:"HO"},fetcher,ac());
 if(!result)throw new Error("Expected canonical Specialty Detail");
 assert.deepEqual(result.row.prerequisiteView,["Gouache"]);
 assert.equal(result.row.levelCount,0);
 assert.equal(result.row.description,null);
 await assert.rejects(specialtyProvider.detail(id,{surface:"BO",centerId:"not-authorized"},fetcher,ac()));
});

test("PAP-1495 S4: Core-backed empty Level is truthful, no phantom mission or writer",async()=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async u=>{calls.push(String(u));return Response.json({data:detail});};
 const result=await loadSpecialtyS4Read(id,fetcher,ac());
 assert.equal(result.distinctMissionCount,0);
 assert.deepEqual(result.levels,[]);
 assert.equal(calls.length,1);
 const page=html(h(SpecialtyMissionsReadContent,{data:result}));
 assert.match(page,/Chuyên đề chưa có Cấp/);
 assert.doesNotMatch(page,/Chưa tải được|Liên kết<\/button>|Gỡ liên kết/);
});

test("PAP-1495 S4: linked Mission list verifies canonical Core GET, duplicates count once",async()=>{
 const mission={id:missionId,version:1,code:"A-01",name:"Hình khối",level:1,
   status:"ACTIVE",plsValue:10,paperSize:null,description:null,guideline:null,
   pathProgramId:path,pathKeySnapshot:null,prerequisiteMissionId:null,prerequisiteCodeSnapshot:null};
 const full={...detail,missionCountDistinct:1,levels:[
   {id:levelId,order:1,name:"Cấp 1",missionIds:[missionId]},
   {id:prereq,order:2,name:"Cấp 2",missionIds:[missionId]}
 ]};
 const calls:string[]=[];
 const fetcher:typeof fetch=async u=>{calls.push(String(u));return Response.json({data:String(u).includes("/missions/")?mission:full});};
 const loaded=await loadSpecialtyS4Read(id,fetcher,ac());
 assert.equal(loaded.distinctMissionCount,1);
 assert.equal(calls.length,2);
 assert.deepEqual(loaded.levels.map(l=>l.missions[0].name),["Hình khối","Hình khối"]);
 const markup=html(h(SpecialtyMissionsReadContent,{data:loaded}));
 assert.match(markup,/Nhiệm vụ liên kết · 1/);
 assert.match(markup,/Cấp 1/);assert.match(markup,/Cấp 2/);assert.match(markup,/A-01/);
 assert.doesNotMatch(markup,/Liên kết<\/button>|Gỡ/);
});

test("PAP-1495 S4: wrong-Path Mission does not become a verified label",async()=>{
 const full={...detail,levels:[{id:levelId,order:1,name:"Cấp 1",missionIds:[missionId]}]};
 const other={id:missionId,version:1,code:"Q-01",name:"Not same Path",level:1,status:"ACTIVE",
  plsValue:10,paperSize:null,description:null,guideline:null,pathProgramId:prereq,
  pathKeySnapshot:null,prerequisiteMissionId:null,prerequisiteCodeSnapshot:null};
 const fetcher:typeof fetch=async u=>Response.json({data:String(u).includes("/missions/")?other:full});
 const result=await loadSpecialtyS4Read(id,fetcher,ac());
 assert.equal(result.levels[0].missions[0].name,null);
 assert.match(html(h(SpecialtyMissionsReadContent,{data:result})),/Không thể xác minh thông tin Nhiệm vụ liên kết/);
});

test("PAP-1495 S4: 403 on Core detail remains denial, never empty",async()=>{
 const fetcher:typeof fetch=async()=>new Response(null,{status:403});
 await assert.rejects(loadSpecialtyS4Read(id,fetcher,ac()),{status:403});
});
