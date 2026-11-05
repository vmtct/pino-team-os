import test from "node:test";
import assert from "node:assert/strict";
import {validateClassroomDraft} from "./tos-classroom-v4-view-model";
test("PAP-945 validation diagnoses unsaved form fields without closing or consuming a Diary",()=>{
 const values={missionIds:["m1","m2"],results:{m1:true,m2:null},interest:1,notes:"",difficulty:"",hasImage:false,uploading:true};
 const before=JSON.stringify(values);assert.equal(validateClassroomDraft(values).length,4);assert.equal(JSON.stringify(values),before);
 assert.deepEqual(validateClassroomDraft({...values,results:{m1:true,m2:false},interest:4,notes:"Quan sát",difficulty:"",hasImage:true,uploading:false}),[]);
 assert.equal(validateClassroomDraft({...values,results:{m1:true,m2:false},interest:1,notes:"Quan sát",hasImage:true,uploading:false}).length,1);
});
