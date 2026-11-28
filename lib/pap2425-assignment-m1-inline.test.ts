import assert from "node:assert/strict";
import {test} from "node:test";
import {createAssignmentM1Adapter} from "../app/bo/missions/MissionAssignmentM1";
import {ASSIGNMENT_M1_ID,staffAssignmentM1} from "../app/bo/missions/assignment-m1-fixture";
import {expandedAssignmentQuery,expandedAssignmentDefinitionFor} from "../app/bo/missions/assignment-expanded-schema";
import {assignmentDefinition} from "../app/bo/missions/schema";
test("PAP-2425 only assignment context editable across native TDD",()=>{
 const d=expandedAssignmentDefinitionFor(staffAssignmentM1);
 assert.deepEqual(d.fields.filter(f=>f.capabilities.inlineEdit).map(f=>f.key),["context"]);
 assert.deepEqual(d.table.inlineEdit,{enabled:true,fields:["context"]});
 assert.ok(d.drawer.sections[0]?.fields.includes("context"));
 assert.ok(d.detail.overview.sections[0]?.fields.includes("context"));
 assert.equal(assignmentDefinition.table.inlineEdit.enabled,false);
});
test("PAP-2425 single versioned local context",async()=>{
 const a=createAssignmentM1Adapter(false,0),s=new AbortController().signal,m=a.mutation!;
 assert.equal((await a.list(expandedAssignmentQuery,s)).rows[0]?.context,null);
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:"  Bối cảnh mẫu  "},"0",a.context,s)).status,"saved");
 const listed=await a.list(expandedAssignmentQuery,s),detail=await a.detail(ASSIGNMENT_M1_ID,s);
 assert.equal(listed.rows[0]?.context,"Bối cảnh mẫu");assert.equal(detail?.row.context,"Bối cảnh mẫu");
 assert.equal(detail?.row.executionVersion,0);assert.equal(detail?.version,"1");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:"stale"},"0",a.context,s)).status,"conflict");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:""},"1",a.context,s)).status,"saved");
 assert.equal((await a.detail(ASSIGNMENT_M1_ID,s))?.row.context,null);
});
test("PAP-2425 foreign/immutable/invalid edit denial",async()=>{
 const a=createAssignmentM1Adapter(false,0),s=new AbortController().signal,m=a.mutation!;
 assert.equal((await m.update("FOREIGN",{context:"x"},"0",a.context,s)).status,"denied");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:"x"},"0",{...a.context},s)).status,"denied");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:"x".repeat(201)},"0",a.context,s)).status,"invalid");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{name:"x"} as never,"0",a.context,s)).status,"invalid");
 assert.equal((await m.update(ASSIGNMENT_M1_ID,{context:"x",status:"Hoàn tất"} as never,"0",a.context,s)).status,"invalid");
 assert.equal((await a.detail(ASSIGNMENT_M1_ID,s))?.version,"0");
});
