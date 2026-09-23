import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view=readFileSync(new URL("../app/bo/system/ai-data/AiDataInboxView.tsx",import.meta.url),"utf8");
const nav=readFileSync(new URL("../app/bo/navigation.ts",import.meta.url),"utf8");
const founderRoute=readFileSync(new URL("../app/api/founder/[...path]/route.ts",import.meta.url),"utf8");
const founderHandler=readFileSync(new URL("./founder-facade-handler.ts",import.meta.url),"utf8");

test("AI Data Inbox uses Founder facade for review/apply and binds approval to plan hash",()=>{
  assert.match(view,/\/api\/founder\/ai\/change-sets/);
  assert.match(view,/expectedPlanHash:detail\.planHash/);
  assert.match(view,/Approve & Apply/);
  assert.match(view,/Reconcile outcome/);
  assert.doesNotMatch(view,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|\w+)/i);
  assert.match(founderRoute,/handleFounderFacadeRequest/);
  assert.match(founderHandler,/callFounderCore/);
  assert.match(founderHandler,/authenticateTeam/);
});

test("AI Data Inbox is surfaced under BO System",()=>{
  assert.match(nav,/href: "\/bo\/system\/ai-data", label: "AI Data Inbox"/);
});
