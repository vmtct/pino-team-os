import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const view=readFileSync(new URL("../app/bo/system/pancake/PancakeIntegrationView.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("./bo-api.ts",import.meta.url),"utf8");
const writes=readFileSync(new URL("./bo-write-handler.ts",import.meta.url),"utf8");

test("PAP-411 uses shared Data Grid while preserving provider identity and bounded commands",()=>{
  assert.match(view,/BoDataGrid/);assert.match(view,/BoDataGridSidePeek/);assert.match(view,/useBoDataGridUrlState/);assert.match(view,/providerPageId/);assert.match(view,/configurePancakeChannel\(channel\.id/);assert.match(view,/expectedVersion:channel\.version/);assert.match(view,/updatePancakeSettings/);assert.match(view,/expectedVersion:load\.settings\.version/);assert.doesNotMatch(view,/conversation_link[^\n]*(?:split|match|slice)\s*\(/i);assert.match(api,/pancakeChannels:/);assert.match(writes,/PANCAKE_CHANNEL_CONFIG/);
});
