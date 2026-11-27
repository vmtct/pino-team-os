import assert from "node:assert/strict";
import {test} from "node:test";
import {TddRegistry} from "../lib/workspace-schema";
import {assignmentDefinition} from "../app/bo/missions/schema";
import {expandedAssignmentDefinitionFor,expandedAssignmentQuery,registerExpandedAssignment} from "../app/bo/missions/assignment-expanded-schema";
import {staffAssignmentM1,staffAssignmentM1Row,ASSIGNMENT_M1_ID} from "../app/bo/missions/assignment-m1-fixture";
test("PAP-2425 native field, filter, Drawer and Detail expansion retains legacy views",()=>{
 const d=expandedAssignmentDefinitionFor(staffAssignmentM1);
 assert.ok(d.table.filters.fields.includes("category"));
 assert.ok(expandedAssignmentQuery.visible.includes("subjectKind"));
 assert.ok(d.drawer.sections[0]?.fields.includes("category"));
 assert.ok(d.detail.overview.sections[0]?.fields.includes("subjectKind"));
 assert.deepEqual(d.table.views.builtIn.map(v=>v.id),assignmentDefinition.table.views.builtIn.map(v=>v.id));
 assert.equal(d.detail.businessTabs.length,0);
 assert.ok(d.actions?.some(a=>a.id==="assignment-open-complete"));
 assert.equal(assignmentDefinition.detail.businessTabs.length,2);
});
test("PAP-2425 one isolated fixture registered by shared TDD registry",()=>{
 const schema=registerExpandedAssignment(new TddRegistry(),staffAssignmentM1,staffAssignmentM1Row);
 assert.equal(schema.key,"missions");
 assert.equal(staffAssignmentM1Row.id,ASSIGNMENT_M1_ID);
 assert.equal(staffAssignmentM1Row.category,"Staff Training");
 assert.equal(staffAssignmentM1Row.student,"Nhân sự mẫu");
});
