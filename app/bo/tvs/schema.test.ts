import assert from "node:assert/strict";import {test} from "node:test";
import {TddRegistry} from "@/lib/workspace-schema";
import {projectCenterTvs,tvDefinition,verifyTvExtension} from "./schema";
const c1="11111111-1111-4111-8111-111111111111",c2="22222222-2222-4222-8222-222222222222",a="33333333-3333-4333-8333-333333333333",b="44444444-4444-4444-8444-444444444444",device="55555555-5555-4555-8555-555555555555";
test("PAP-1266 Center TV projection excludes cross-Center and never fabricates online",()=>{
 const records=projectCenterTvs([{id:a,key:"house-a",displayName:"House A",description:null,runtimeType:"PINORIA_HOUSE",scopeType:"CENTER",scopeId:c1,centerName:"Cần Thơ",orientation:"LANDSCAPE",targetAspectRatio:"16:9",definitionVersion:1,status:"ACTIVE"},{id:b,key:"house-b",displayName:"House B",description:null,runtimeType:"PINORIA_HOUSE",scopeType:"CENTER",scopeId:c2,centerName:"Elsewhere",orientation:"LANDSCAPE",targetAspectRatio:"16:9",definitionVersion:1,status:"ACTIVE"}],[{id:device,centerId:c1,defaultDisplayId:a,lastSeenAt:null}],c1);
 assert.equal(records.length,1);assert.equal(records[0]?.id,a);assert.equal(records[0]?.deviceCount,1);assert.equal(records[0]?.lastSeen,"Chưa từng kết nối");assert.equal(records[0]?.status,"ACTIVE");
});
test("PAP-1266 TDD keeps canonical system tabs with bounded Không gian extension",()=>{const r=new TddRegistry((approval,scope)=>verifyTvExtension(approval,scope));const schema=r.register({...tvDefinition,data:{id:"fixture",list:async()=>({rows:[],total:0}),detail:async()=>null}});assert.deepEqual(schema.detail.businessTabs.map(tab=>tab.label),["Không gian"]);assert.equal(schema.surface,"BO");assert.equal(schema.key,"tvs")});
