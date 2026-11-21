import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../app/components/mytime-workshop/schema.ts",import.meta.url),"utf8");
const workspace=readFileSync(new URL("../app/components/mytime-workshop/WorkshopWorkspace.tsx",import.meta.url),"utf8");
test("PAP-2242 Participation business extension is BO-only and Founder scoped",()=>{
 assert.ok(schema.includes('businessTabs:surface==="BO"?'));
 assert.ok(schema.includes('scope.surface==="BO"'));
 assert.ok(schema.includes('approval.jira===participationApproval.jira'));
 assert.ok(schema.includes("new TddRegistry(verifyWorkshopParticipation)"));
});
test("PAP-2242 native Detail retains Participation navigation and explicit pending Core state",()=>{
 assert.ok(workspace.includes('p.tab==="participation"'));
 assert.ok(workspace.includes('active==="participation"'));
 assert.ok(workspace.includes("renderApprovedExtension="));
 assert.ok(workspace.includes("unavailable/>"));
 assert.ok(workspace.includes("WorkshopParticipationTab"));
});
