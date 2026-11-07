import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { specialtyDefinition, specialtyProvider, specialtyQuery, verifySpecialtyExtension } from "../app/ho/learning/specialties/schema";
import { TddRegistry, composeTabs, authorizedTabs, type ModuleRow } from "./workspace-schema";
import { TddTable, TddDrawer, TddDetail } from "../app/components/workspace-renderer";
import { createHoTddAdapter } from "./workspace-adapters";
import { requiresSpecialtySelectionGuard } from "./tos-specialty-mission-availability";
import { decideHostBoundary } from "./host-boundary";

const registry = new TddRegistry(verifySpecialtyExtension);
const schema = registry.register({...specialtyDefinition,data:{id:"test-only-specialty",
  list:async()=>({rows:[],total:0}),detail:async()=>null}});
const context = {surface:"HO" as const,authorize:(permission:string)=>permission==="catalog.learning.view"};
const record:ModuleRow<typeof specialtyDefinition.fields> = {
  id:"specialty-test",name:"Chuyên đề hình khối",path:"Mỹ thuật",status:"ACTIVE",description:"Quan sát hình khối",
  levelCount:2,prerequisiteView:[],tagView:["Hình khối"],missionCount:3,
  createdTime:"—",createdBy:"—",lastModifiedTime:"—",lastModifiedBy:"—",
};
const noop=()=>{};

test("PAP-1495: route remains HO-only and TDD has one ordered business tab",()=>{
  assert.equal(decideHostBoundary("ho.staging.pinohouse.art","/ho/learning/specialties").action,"next");
  for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])
    assert.equal(decideHostBoundary(host,"/ho/learning/specialties").action,"not_found");
  assert.deepEqual(composeTabs(schema).map(tab=>tab.label),["Tổng quan","Nhiệm vụ","Lịch sử"]);
  assert.deepEqual(authorizedTabs(schema,{...context,authorize:()=>false}),[]);
  assert.equal(specialtyProvider.mutation,undefined);
  assert.deepEqual(Object.keys(schema.capabilities),["read"]);
  assert.ok(schema.fields.every(field=>field.readOnly&&!field.capabilities.inlineEdit));
});

test("PAP-1495: shared Table, Quick View and Detail keep geometry/properties without authoring",()=>{
  const base={registry,schema,context};
  const table=html(h(TddTable<typeof specialtyDefinition.fields>,{...base,rows:[record],query:specialtyQuery,status:"ready",onQueryChange:noop,onOpen:noop}));
  const drawer=html(h(TddDrawer<typeof specialtyDefinition.fields>,{...base,record,onClose:noop,onDetail:noop}));
  const detail=html(h(TddDetail<typeof specialtyDefinition.fields>,{...base,record,onBack:noop,subject:{type:"specialties",id:record.id}}));
  assert.match(table,/Chuyên đề hình khối/);
  assert.match(drawer,/Full Detail/);
  assert.match(detail,/v24-prop-grid/);
  for(const output of [table,drawer,detail])assert.doesNotMatch(output,/Tạo mới|Lưu thay đổi|prototype|fixture|PAP-1495/);
  const denied=html(h(TddDetail<typeof specialtyDefinition.fields>,{...base,context:{...context,authorize:()=>false},record,onBack:noop,subject:{type:"specialties",id:record.id}}));
  assert.doesNotMatch(denied,/Chuyên đề hình khối|Quan sát hình khối/);
  const history=html(h(TddDetail<typeof specialtyDefinition.fields>,{...base,record,activeTab:"history",onBack:noop,subject:{type:"specialties",id:record.id}}));
  assert.match(history,/Core chưa cung cấp lịch sử thay đổi Chuyên đề được xác minh/);
});

test("PAP-1495: real Founder GET errors stay errors, BO is denied and no fixture data leaks",async()=>{
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;return Response.json({error:{code:"SPECIALTY_V2_UNAVAILABLE"}},{status:503});};
  const signal=new AbortController().signal;
  const id="01234567-89ab-7cde-8fab-0123456789ab";
  await assert.rejects(specialtyProvider.list(specialtyQuery,{surface:"HO"},fetcher,signal),{status:503});
  await assert.rejects(specialtyProvider.detail(id,{surface:"HO"},fetcher,signal),{status:503});
  await assert.rejects(specialtyProvider.list(specialtyQuery,{surface:"BO",centerId:"other"},fetcher,signal),{status:403});
  await assert.rejects(specialtyProvider.detail(id,{surface:"BO",centerId:"other"},fetcher,signal),{status:403});
  // S3 resolves Core canonical Path options once for list and once for detail.
  assert.equal(calls,4);
});

test("PAP-1495: adapter still requires real authenticated context and canonical permission",async()=>{
  for(const status of [401,403])await assert.rejects(createHoTddAdapter({
    registry:new TddRegistry(verifySpecialtyExtension),definition:specialtyDefinition,provider:specialtyProvider,
    origin:"https://ho.staging.pinohouse.art",fetcher:async()=>Response.json({error:{}},{status}),
  },new AbortController().signal),{status});
  await assert.rejects(createHoTddAdapter({registry:new TddRegistry(verifySpecialtyExtension),
    definition:specialtyDefinition,provider:specialtyProvider,origin:"https://ho.staging.pinohouse.art",
    fetcher:async()=>Response.json({data:{surface:"BO",entitled:true,userId:"test-user",permissionKeys:["team.bo.access"]}}),
  },new AbortController().signal),{status:403});
});

test("PAP-1496: unavailable Student tab renders no invented empty grants or enabled grant action",()=>{
  const require=createRequire(import.meta.url),prior=require.extensions[".css"];
  require.extensions[".css"]=module=>{module.exports={};};
  try{
    const {StudentSpecialtyTab}=require("../app/bo/learners/StudentSpecialtyTab") as typeof import("../app/bo/learners/StudentSpecialtyTab");
    const unavailable=html(h(StudentSpecialtyTab,{items:undefined,currentCenterLocalDate:"",readOnly:true}));
    assert.match(unavailable,/role="alert"/);
    assert.doesNotMatch(unavailable,/Chưa có Chuyên Đề khả dụng|Mở khóa Chuyên Đề|Hoàn thành/);
    const item={specialty:{id:"spec",name:"Hình khối",pathProgramId:"art"},grant:null,grantEffective:false,
      progress:{completedDistinctMissionCount:0,totalDistinctMissionCount:1,completionStatus:"NOT_COMPLETED",missingMissionIds:["m1"]},
      canGrant:true,grantBlockReasons:[]};
    let writes=0;
    const readonly=html(h(StudentSpecialtyTab,{items:[item],currentCenterLocalDate:"2026-11-06",readOnly:true,onGrant:async()=>{writes++;}}));
    assert.match(readonly,/<button type="button" disabled="">Mở khóa Chuyên Đề/);
    assert.equal(writes,0);
  }finally{if(prior)require.extensions[".css"]=prior;else delete require.extensions[".css"];}
});

test("PAP-1497: existing eligible-only data preserved; any unsupported all/locked extension guarded",()=>{
  const legacy={missionId:"m1",code:"M1",name:"Hình khối",level:1,assignmentId:null};
  assert.equal(requiresSpecialtySelectionGuard([legacy]),false);
  assert.equal(requiresSpecialtySelectionGuard([]),false);
  for(const items of [undefined,[null],[{...legacy,available:true,lockReasons:[]}],
    [{...legacy,available:false,lockReasons:[{code:"FUTURE_START_DATE"}]}],[{...legacy,available:undefined}]])
    assert.equal(requiresSpecialtySelectionGuard(items),true);
  const source=readFileSync("app/components/tos-vnext/DiaryCapturePanel.tsx","utf8");
  assert.equal(source.match(/requiresSpecialtySelectionGuard\(fresh.items\)/g)?.length,2);
  // PAP-1497: the server-authenticated extension may render in the real Diary
  // flow, but it MUST remain read-only until Core S4 owns write enforcement.
  assert.match(source,/import.*TosSpecialtyMissionChoiceList/);
  assert.match(source,/current\.phase==="ready"&&specialtyGuarded&&<section/);
  assert.match(source,/<TosSpecialtyMissionChoiceList[\s\S]*?onSelect=\{\(\)=>\{\}\} disabled\/>/);
  assert.match(source,/permitted&&!specialtyGuarded&&<fieldset/);
  assert.match(source,/data-specialty-selection="read-only"/);
  assert.doesNotMatch(source,/onSelect=\{(?:submitDiary|toggleMission)\}/);
});

test("PAP-1497: extended Core eligibility renders available and locked choices without enabling writes",()=>{
  const require=createRequire(import.meta.url),prior=require.extensions[".css"];
  require.extensions[".css"]=module=>{module.exports={};};
  try{
    const {TosSpecialtyMissionChoiceList}=require("../app/classroom/TosSpecialtyMissionChoiceList") as typeof import("../app/classroom/TosSpecialtyMissionChoiceList");
    const choices=[
      {missionId:"m2",code:"P-02",name:"Vẽ chân dung",level:2,assignmentId:null,
        available:false,lockReasons:[{code:"NO_EFFECTIVE_SPECIALTY_GRANT",relatedId:"spec-2"}]},
      {missionId:"m1",code:"P-01",name:"Vẽ hình khối",level:1,assignmentId:null,
        available:true,lockReasons:[]},
    ];
    let selected=0;
    const output=html(h(TosSpecialtyMissionChoiceList,{items:choices,studentName:"Học viên A",
      onSelect:()=>{selected++;},disabled:true}));
    assert.match(output,/Chọn Nhiệm Vụ · Học viên A/);
    assert.match(output,/Vẽ hình khối/);
    assert.match(output,/Vẽ chân dung/);
    assert.ok(output.indexOf("Vẽ hình khối")<output.indexOf("Vẽ chân dung"));
    assert.match(output,/Đang khóa/);
    assert.match(output,/Xem lý do khóa/);
    assert.match(output,/Có thể chọn/);
    assert.match(output,/disabled=""/);
    assert.equal(selected,0);
    const rejected=html(h(TosSpecialtyMissionChoiceList,{items:[{missionId:"x",code:"X",name:"Legacy",level:1,assignmentId:null}],
      studentName:"Học viên B",onSelect:()=>{selected++;},disabled:true}));
    assert.match(rejected,/role="alert"/);
    assert.doesNotMatch(rejected,/Chọn nhiệm vụ/);
    assert.equal(selected,0);
  }finally{if(prior)require.extensions[".css"]=prior;else delete require.extensions[".css"];}
});

test("PAP-1495/1496: one HO shell; Student tab behind scoped read and before History",()=>{
  const ho=readFileSync("app/ho/learning/specialties/HoSpecialties.tsx","utf8");
  assert.equal(ho.match(/<HoWorkspace\b/g)?.length,1);
  assert.doesNotMatch(ho,/fetch\(|method:|localStorage|SpecialtyWorkspace/);
  const bo=readFileSync("app/bo/learners/StudentFullDetail.tsx","utf8");
  assert.match(bo,/detail.scope !== scope/);
  assert.match(bo,/data.student.id !== studentId/);
  assert.ok(bo.indexOf('id: "specialties"')<bo.indexOf('id: "history"'));
  assert.match(bo,/<StudentSpecialtyTab[^>]*items=\{undefined\}[^>]*readOnly/);
  assert.doesNotMatch(bo,/student-specialty-grants|specialty\/purchases/);
});
