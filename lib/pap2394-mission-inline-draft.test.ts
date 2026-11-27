import test from "node:test";
import assert from "node:assert/strict";
import {prepareMissionInlineDraft} from "../app/ho/learning/missions/mission-inline-draft";
import type {MissionEditLoad} from "../app/ho/learning/missions/read-edit";
import type {MissionPathChoice} from "../app/ho/learning/missions/mission-path-options";
const paths:readonly MissionPathChoice[]=[
 {id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"},
 {id:"01900000-0000-7000-8000-000000000012",code:"pianohouse",label:"PianoHouse"},
 {id:"01900000-0000-7000-8000-000000000013",code:"little-piner-art",label:"Little Piner Art"},
 {id:"01900000-0000-7000-8000-000000000014",code:"little-piner-piano",label:"Little Piner Piano"},
];
const id="01900000-0000-7000-8000-000000002394";
const source:Extract<MissionEditLoad,{state:"ready"}>={state:"ready",id,version:5,data:{category:null,supplementalUrl:"https://example.test/guide",name:"Historical",code:"HIST-1",level:2,status:"ACTIVE",plsValue:30,paperSize:"A4",description:null,guideline:"Guide",pathProgramId:paths[0]!.id,pathKeySnapshot:paths[0]!.code,prerequisiteMissionId:null,prerequisiteCodeSnapshot:"OLD"}};
const prep=(patch:unknown,version="5",current:MissionEditLoad=source)=>prepareMissionInlineDraft(current,id,patch,version,paths);
test("PAP-2394 M3 inline draft only changes one approved field and retains historical metadata",()=>{
 for(const [key,value] of Object.entries({name:"New",code:"new-code",category:"Staff Training",level:5,plsValue:45,path:"PianoHouse",description:"Description",guideline:"Guide 2",supplementalUrl:" https://example.test/new "})){
  const outcome=prep({[key]:value});assert.equal(outcome.status,"ready",key);if(outcome.status!=="ready")throw Error(key);
  assert.equal(outcome.expectedVersion,5);
  const expected=key==="path"?{pathProgramId:paths[1]!.id,pathKeySnapshot:paths[1]!.code}:{[key]:typeof value==="string"?(key==="code"?value.toUpperCase():value.trim()):value};
  assert.deepEqual(outcome.data,{...source.data,...expected});
 }
 assert.equal(source.data.category,null);assert.equal(source.data.plsValue,30);
 const clear=prep({supplementalUrl:null});assert.equal(clear.status,"ready");if(clear.status==="ready")assert.equal(clear.data.supplementalUrl,null);
});
test("PAP-2394 M3 inline draft rejects stale, inactive, unknown and invalid patches without mutation",()=>{
 for(const patch of [null,[],{}, {name:"x",code:"NEW"},{status:"INACTIVE"},{paperSize:"B5"},{category:null},{category:"Other"},{level:0},{plsValue:-1},{name:" "},{code:"!"},{path:"Unknown"},{supplementalUrl:"javascript:alert(1)"},{description:"x".repeat(4001)},{guideline:"x".repeat(8001)}])assert.equal(prep(patch).status,"invalid",JSON.stringify(patch).slice(0,60));
 assert.equal(prep({name:"New"},"4").status,"conflict");
 assert.equal(prep({name:"New"},"5",{...source,data:{...source.data,status:"INACTIVE"}}).status,"denied");
 assert.equal(prepareMissionInlineDraft(source,id,{name:"New"},"5",paths.slice(0,3)).status,"invalid");
 assert.equal(prepareMissionInlineDraft(source,"wrong",{name:"New"},"5",paths).status,"denied");
});
