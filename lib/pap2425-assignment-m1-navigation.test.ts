import assert from "node:assert/strict";
import {test} from "node:test";
import {assignmentLocalRecord,assignmentLocalStage} from "../app/bo/missions/assignment-m1-navigation";
import {expandedAssignmentQuery} from "../app/bo/missions/assignment-expanded-schema";
const url="http://desktop-isrdren:8800/bo/missions";
const id="ASSIGNMENT-MOCK-001";
test("PAP-2425 local record admission rejects foreign, duplicate and unrecognized state",()=>{
 assert.equal(assignmentLocalRecord(new URL(url)),undefined);
 assert.equal(assignmentLocalRecord(new URL(url+"?record="+id)),id);
 for(const invalid of [url+"?record=real",url+"?record="+id+"&record="+id,url+"?other=x",url+"#foreign","http://other:8800/bo/missions","http://desktop-isrdren:8800/bo/parents"])assert.throws(()=>assignmentLocalRecord(new URL(invalid)));
});
test("PAP-2425 canonical direct link opens Drawer; owned same-record history retains Detail",()=>{
 assert.equal(assignmentLocalStage(id,undefined).kind,"drawer");
 assert.equal(assignmentLocalStage(id,{kind:"detail",recordId:id,tab:"history",query:expandedAssignmentQuery}).kind,"detail");
 assert.equal(assignmentLocalStage(id,{kind:"detail",recordId:"FOREIGN",tab:"history",query:expandedAssignmentQuery}).kind,"drawer");
 assert.equal(assignmentLocalStage(undefined,{kind:"detail",recordId:id,tab:"history",query:expandedAssignmentQuery}).kind,"table");
});
