import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("PAP-2288 canonical staging route mounts native Lead only after verified authorization; production stays gated",()=>{
 const page=fs.readFileSync("app/bo/sales/leads/page.tsx","utf8");
 const view=fs.readFileSync("app/bo/sales/leads/SalesLeadPipelineView.tsx","utf8");
 const shell=fs.readFileSync("app/bo/shell/BoApplicationShell.tsx","utf8");
 const native=fs.readFileSync("app/bo/sales/leads/NativeLeadEntry.tsx","utf8");
 assert.match(page,/await authorizeBoShell\([\s\S]*?actor.permissionKeys.includes\("acquisition.lead.manage"\)[\s\S]*?credential.kind!=="password"[\s\S]*?return <NativeLeadEntry actorId=\{actor.userId\}\/>/);
 assert.match(page,/env.APP_ENV!=="staging"\|\|host!==BO_STAGING_RETURN_HOST/);
 assert.match(page,/resolveLegacyLeadIntent\(env.PINO_BO_CORE,credential,actor.userId,query.leadIntent\)/);
 assert.match(page,/canonicalLeadStageQuery\(raw\)/);
 assert.doesNotMatch(page,/LeadHouseholdM1Preview|localReview/);
 assert.match(page,/if\(!actor.permissionKeys.includes\("acquisition.lead.manage"\)\)forbidden\(\);\s*return <SalesLeadPipelineView \/>;/);
 assert.match(native,/readApi=\{state.adapter.api\} commandApi=\{state.adapter.api\}/);
 assert.doesNotMatch(view,/m1Preview|LeadHouseholdM1Preview/);
 assert.match(view,/return <SalesLeadIntentPipelineView \/>;/);
 assert.doesNotMatch(shell,/sales\/leads\?m1Preview/);
});
