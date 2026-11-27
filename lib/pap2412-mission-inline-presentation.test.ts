import test from "node:test";
import assert from "node:assert/strict";
import {missionIntegratedDefinition,missionCategoryDefinition,missionInlineFields,missionInlineTableFields} from "../app/ho/learning/missions/schema";
import {MISSION_METADATA_COMMAND,missionPresentationSelection,type MissionHost,type MissionMetadataPresentation} from "../app/ho/learning/missions/mission-inline-presentation";
const id="01900000-0000-7000-8000-000000002394";
const row={id,status:"ACTIVE",name:"Historical",code:"HIST-1",category:null,level:2,plsValue:30,path:"Artchitect",description:null,guideline:"Guide",supplementalUrl:null};
const context={surface:"HO",authorize:(p:string)=>["catalog.learning.view","learning.mission.manage"].includes(p)};
const presentation:MissionMetadataPresentation={command:MISSION_METADATA_COMMAND,render:()=>null};
const select=(host:MissionHost,field:string,options:Partial<{schema:Parameters<typeof missionPresentationSelection>[0];context:Parameters<typeof missionPresentationSelection>[1];presentation:MissionMetadataPresentation|undefined;row:Readonly<Record<string,unknown>>;version:string|undefined;generic:boolean}>={})=>missionPresentationSelection(options.schema??missionIntegratedDefinition,options.context??context,Object.hasOwn(options,"presentation")?options.presentation:presentation,host,options.row??row,Object.hasOwn(options,"version")?options.version:"5",field,options.generic??false);
test("PAP-2412 presentation admits exactly six Table and nine Drawer/Detail fields with authorized current source",()=>{
 for(const host of ["table","drawer","detail"] as const){
  for(const field of missionInlineFields){
   const allowed=host!=="table"||missionInlineTableFields.some(f=>f===field);
   assert.deepEqual(select(host,field),allowed?{id,expectedVersion:"5",field}:null);
  }
  for(const field of ["id","status","createdAt","updatedBy","paperSize","prerequisite","permission"])assert.equal(select(host,field),null);
 }
});
test("PAP-2412 presentation rejects unrelated surfaces, no permissions, generic writes, archived and unversioned rows",()=>{
 for(const options of [
  {schema:{...missionIntegratedDefinition,key:"roles"}},{schema:{...missionIntegratedDefinition,surface:"BO"}},
  {schema:missionCategoryDefinition},{context:{...context,surface:"TOS"}},{context:{...context,authorize:()=>false}},
  {context:{...context,authorize:(p:string)=>p==="catalog.learning.view"}},{generic:true},{presentation:undefined},
  {presentation:{...presentation,command:{...MISSION_METADATA_COMMAND}}},
  {row:{...row,status:"INACTIVE"}},{row:{...row,id:"MISSION-MOCK-001"}},
  {version:undefined},{version:"0"},{version:"01"},{version:"9007199254740992"}
 ])assert.equal(select("drawer","name",options),null);
 for(const [field,value] of Object.entries({name:"",code:"!",category:"Other",level:6,plsValue:-1,path:"Unknown",description:"x".repeat(4001),guideline:3,supplementalUrl:"javascript:alert(1)"}))
  assert.equal(select("detail",field,{row:{...row,[field]:value}}),null,field);
 const wrongField={...missionIntegratedDefinition,fields:missionIntegratedDefinition.fields.map(f=>f.key==="name"?{...f,permission:"access.role.view"}:f)};
 assert.equal(select("table","name",{schema:wrongField}),null);
});
