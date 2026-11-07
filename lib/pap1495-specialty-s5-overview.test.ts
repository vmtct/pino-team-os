import test from "node:test";
import assert from "node:assert/strict";
import {eligibleSpecialtyPrerequisites,planSpecialtyOverviewEdit} from "./ho-specialty-s5-overview";
import {mapVerifiedSpecialtyMissionOptions} from "./ho-specialty-s5-missions";
import {searchLinkableSpecialtyMissions} from "./specialty-mission-picker";
import type {SpecialtyV2Detail,SpecialtyV2Summary} from "./ho-specialty-v2-reader";
import type {BoRecord} from "./bo-registration";
const id="01a1b541-4343-7872-bfad-022572a7d89b";
const path="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const second="01a1b544-d2b8-7397-a4e2-9cd2830d78a4";
const other="01a1b548-cb12-7e38-b5f0-4ec12e99c3ba";
const mission="01a1b5f2-519e-7b0f-b22b-d3d0481c0fae";
const s:SpecialtyV2Detail={id,pathProgramId:path,name:"Chân dung",status:"DRAFT",
 description:null,tags:["Art"],version:2,missionCountDistinct:0,prerequisiteIds:[],
 levels:[{id:other,order:1,name:"Level 1",missionIds:[]}]};
const list:SpecialtyV2Summary[]=[s,{...s,id:second,name:"Nền tảng"}, {...s,id:other,name:"Nền tảng"}];
test("PAP-1495 S5: choose stable actual id from ambiguous prerequisite names; no self link",()=>{
 const opts=eligibleSpecialtyPrerequisites(s,list);
 assert.equal(opts.length,2);
 assert.ok(opts.every(o=>o.label.startsWith("Nền tảng ·")));
 assert.deepEqual(planSpecialtyOverviewEdit(s,list,"prerequisiteView",[opts[0]!.label]).prerequisiteIds,[second]);
 assert.throws(()=>planSpecialtyOverviewEdit(s,list,"prerequisiteView",["Nền tảng"]));
 assert.throws(()=>planSpecialtyOverviewEdit(s,list,"prerequisiteView",[opts[0]!.label,opts[0]!.label]));
});
test("PAP-1495 S5: Cấp/Tag patch retains other canonical metadata; denied published edits",()=>{
 assert.deepEqual(planSpecialtyOverviewEdit(s,list,"levelCount",3),{
  type:"SET_OVERVIEW",expectedVersion:2,levelCount:3,prerequisiteIds:[],tags:["Art"],
 });
 assert.deepEqual(planSpecialtyOverviewEdit(s,list,"tagView",["Art","Anime"]).tags,["Art","Anime"]);
 for(const x of [-1,21,2.5,"3"])assert.throws(()=>planSpecialtyOverviewEdit(s,list,"levelCount",x));
 for(const x of [["Art","art"],[""],["  "],["a".repeat(49)]])assert.throws(()=>planSpecialtyOverviewEdit(s,list,"tagView",x));
 assert.throws(()=>planSpecialtyOverviewEdit({...s,status:"ACTIVE"},list,"levelCount",2));
});
test("PAP-1495 S5: canonical Mission catalog strictly excludes unverified states/Paths",()=>{
 const raw=[
 {id:mission,code:"V-HINH-01",name:"Vẽ Hình",pathProgramId:path,status:"ACTIVE",reconciliation:"READY"},
 {id:second,code:"V-HINH-02",name:"Vẽ Hình 2",pathProgramId:path,status:"ACTIVE",reconciliation:"PENDING"},
 {id:other,code:"V-HINH-03",name:"Vẽ Hình 3",pathProgramId:path,status:"INACTIVE",reconciliation:"READY"},
 {id,code:"V-HINH-04",name:"Vẽ Hình 4",pathProgramId:null,status:"ACTIVE",reconciliation:"READY"},
 ] as BoRecord[];
 const opts=mapVerifiedSpecialtyMissionOptions(raw,s);
 assert.equal(opts.length,4);
 assert.deepEqual(searchLinkableSpecialtyMissions(opts,path,new Set(),"ve hinh").map(x=>x.id),[mission]);
 assert.equal(searchLinkableSpecialtyMissions(opts,path,new Set([mission]),"ve hinh").length,0);
 assert.throws(()=>mapVerifiedSpecialtyMissionOptions([raw[0]!,raw[0]!],s));
 assert.throws(()=>mapVerifiedSpecialtyMissionOptions([{...raw[0],id:"wrong"}] as BoRecord[],s));
});
