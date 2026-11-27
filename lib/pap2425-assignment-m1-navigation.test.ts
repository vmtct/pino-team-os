import assert from "node:assert/strict";
import {test} from "node:test";
import {assignmentLocalRecord,assignmentLocalStage,assignmentLocalHref} from "../app/bo/missions/assignment-m1-navigation";
import {expandedAssignmentQuery} from "../app/bo/missions/assignment-expanded-schema";
const url="http://desktop-isrdren:8800/bo/missions";
const id="ASSIGNMENT-MOCK-001",record=url+"?record="+id,detail=record+"&surface=detail";
const make=(suffix:string)=>new URL(suffix);
test("PAP-2425 exact shared PAP-2347 route grammar rejects foreign, duplicate, unsupported or unbound state",()=>{
 assert.equal(assignmentLocalRecord(make(url)),undefined);
 assert.equal(assignmentLocalRecord(make(record)),id);
 for(const invalid of [url+"?record=real",record+"&record="+id,url+"?other=x",url+"#foreign","http://other:8800/bo/missions","http://desktop-isrdren:8800/bo/parents",url+"?surface=detail",record+"&tab=history",record+"&surface=drawer",record+"&surface=",detail+"&surface=detail",detail+"&tab=history&tab=history",detail+"&tab=diary",detail+"&tab=results",detail+"&tab=",detail+"&view=all",detail+"&extra=x"])assert.throws(()=>assignmentLocalRecord(make(invalid)),invalid);
});
test("PAP-2425 URL is stage/tab authority even if opaque reload clears history",()=>{
 assert.equal(assignmentLocalStage(make(url)).kind,"table");
 assert.equal(assignmentLocalStage(make(record)).kind,"drawer");
 assert.equal(assignmentLocalStage(make(detail)).kind,"detail");
 assert.equal(assignmentLocalStage(make(detail+"&tab=overview")).tab,"overview");
 assert.equal(assignmentLocalStage(make(detail+"&tab=history")).tab,"history");
 const owned={kind:"detail" as const,recordId:id,tab:"history",query:{...expandedAssignmentQuery,search:"sample"}};
 assert.equal(assignmentLocalStage(make(record),owned).kind,"drawer");
 assert.equal(assignmentLocalStage(make(detail),owned).query.search,"");
 assert.equal(assignmentLocalStage(make(detail+"&tab=history"),owned).query.search,"sample");
 assert.equal(assignmentLocalStage(make(detail+"&tab=history"),{...owned,recordId:"FOREIGN"}).query.search,"");
});
test("PAP-2425 native navigation writes canonical reload-safe URL only",()=>{
 const base=assignmentLocalStage(make(url)),drawer=assignmentLocalStage(make(record)),full=assignmentLocalStage(make(detail+"&tab=history"));
 assert.equal(assignmentLocalHref(base),"/bo/missions");
 assert.equal(assignmentLocalHref(drawer),"/bo/missions?record="+id);
 assert.equal(assignmentLocalHref(full),"/bo/missions?record="+id+"&surface=detail&tab=history");
 assert.throws(()=>assignmentLocalHref({...full,recordId:"FOREIGN"}));
 assert.throws(()=>assignmentLocalHref({...full,tab:"diary"}));
 assert.throws(()=>assignmentLocalHref({...drawer,tab:"history"}));
});
