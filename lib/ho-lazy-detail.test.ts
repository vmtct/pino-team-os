import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadHoA1,loadHoA1Detail,mapHoSyllabiDirectory} from "./ho-a1";
import {mapHoRoleDirectory} from "./ho-system";
const id="0198d050-56c1-7ac5-b9ab-b0e45d912345";
test("Syllabi list needs only directory and owner catalog, not one HTTP detail per row",async()=>{
 const calls:string[]=[];
 const syllabus={id,code:"ART-1",owner:{type:"HOUSE_PATH",id:"path-1"},lifecycle:"ACTIVE",createdAt:"2026-01-01T00:00:00Z"};
 const rows=Array.from({length:10},(_,i)=>({syllabus:{...syllabus,id:i===0?id:"0198d050-56c1-7ac5-b9ab-"+String(i).padStart(12,"0")},latestPublishedTitle:"Art",latestPublishedVersionNumber:1,currentDraftVersionNumber:2}));
 const f=async(input:RequestInfo|URL)=>{const url=String(input);calls.push(url);if(url.endsWith("/owners"))return Response.json({data:{housePaths:[{id:"path-1",displayName:"Art"}],houseCurricula:[],toppiPrograms:[]}});if(url.endsWith("/learning/syllabi"))return Response.json({data:rows}); if(url.endsWith("/"+id))return Response.json({data:{syllabus,versions:[{versionNumber:1,state:"PUBLISHED",title:"Art"}],currentDraft:{title:"Draft"}}});throw Error("Unexpected HTTP "+url);};
 const result=await loadHoA1("syllabi",f as typeof fetch);
 assert.equal(result.length,10);
 assert.equal(calls.length,2);
 assert.equal(result[0].owner,"Art");assert.deepEqual(result[0].versions,[]);
 const detail=await loadHoA1Detail("syllabi",result[0],f as typeof fetch);
 assert.deepEqual(detail.versions,["v1 · PUBLISHED · Art"]);
 assert.equal(calls.length,3);
 await assert.rejects(()=>loadHoA1Detail("syllabi",result[0],(async()=>Response.json({data:{syllabus:{id:"other"},versions:[]}})) as typeof fetch));
});
test("Roles render summary with zero detail fan-out; drawer can hydrate safely",()=>{
 const roles=[{id,roleKey:"founder",displayName:"Founder",roleType:"system",status:"active",description:"A",permissionCount:4,assignmentCount:2}];
 const rows=mapHoRoleDirectory(roles as never);
 assert.equal(rows.length,1);assert.equal(rows[0].permissionCount,4);assert.deepEqual(rows[0].permissionKeys,[]);
});
test("Only HO opts into on-demand detail, preserving BO drawer behavior",()=>{
 const workspace=readFileSync("app/ho/HoWorkspace.tsx","utf8"),bo=readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx","utf8"),drawer=readFileSync("app/bo/components/registration/BoQuickView.tsx","utf8");
 assert.match(workspace,/loadRecordDetails/);assert.doesNotMatch(workspace,/roles\.slice\(i,i\+4\)/);
 assert.match(bo,/if \(!ho \|\| !drawerId \|\| !source\.loadRecordDetails\) return/);
 assert.match(drawer,/disabled=\{detailLoading \|\| Boolean\(detailError\)\}/);
});
