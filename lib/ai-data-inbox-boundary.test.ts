import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view=readFileSync(new URL("../app/bo/system/ai-data/AiDataInboxView.tsx",import.meta.url),"utf8");
const nav=readFileSync(new URL("../app/bo/navigation.ts",import.meta.url),"utf8");
const founderRoute=readFileSync(new URL("../app/api/founder/[...path]/route.ts",import.meta.url),"utf8");
const founderHandler=readFileSync(new URL("./founder-facade-handler.ts",import.meta.url),"utf8");

test("AI Data Inbox keeps Founder facade authority and exact-plan approval binding",()=>{
  assert.match(view,/\/api\/founder\/ai\/change-sets/);
  assert.match(view,/expectedPlanHash:detail\.planHash/);
  assert.match(view,/Approve & Apply/);
  assert.match(view,/Reconcile outcome/);
  assert.match(view,/BoDataGrid/);
  assert.match(view,/BoDataGridSidePeek/);
  assert.match(view,/useBoDataGridUrlState/);
  assert.match(view,/Filter AI Data Change Sets by review state/);
  assert.doesNotMatch(view,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|\w+)/i);
  assert.match(founderRoute,/handleFounderFacadeRequest/);
  assert.match(founderHandler,/callFounderCore/);
  assert.match(founderHandler,/teamCredential/);
  assert.match(founderHandler,/credential\.kind !== "password"/);
});

test("AI Data Inbox remains under BO System without exposing casual inline destructive actions",()=>{
  assert.match(nav,/href: "\/bo\/system\/ai-data", label: "AI Data Inbox"/);
  assert.doesNotMatch(view,/Delete Change Set|Raw SQL|Run SQL|Update row/i);
  assert.match(view,/CREATE ONLY/);
  assert.match(view,/Plan hash — approval binds to this exact payload/);
});
