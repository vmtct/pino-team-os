import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {billMethodAllowed,isBoBillsPath} from "./bo-bills-paths";
import {billSchema,billQuery,billSubscriptionChoiceLabel} from "../app/bo/bills/schema";
import {toLegacyTableState} from "./workspace-schema/compatibility";

const draft="123e4567-e89b-42d3-a456-426614174000";
const line="123e4567-e89b-42d3-a456-426614174001";
test("PAP-1421: Bills path admits exact Draft verbs only",()=>{
  assert.equal(isBoBillsPath("billing/bill-drafts"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts","POST"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts","GET"),false);
  assert.equal(billMethodAllowed("billing/bill-drafts/center/"+draft,"GET"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/center/"+draft,"POST"),false);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft,"GET"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft,"PATCH"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft,"DELETE"),false);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/issue-preview","GET"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/issue-preview","POST"),false);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/issue","POST"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/issue","GET"),false);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/items","POST"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/items/"+line,"PATCH"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/items/"+line,"DELETE"),true);
  assert.equal(billMethodAllowed("billing/bill-drafts/"+draft+"/items/"+line,"GET"),false);
});
test("PAP-1421: malformed paths and unsupported financial writes remain denied",()=>{
  assert.equal(isBoBillsPath("billing/bills/"+draft+"/void"),false);
  for(const path of [
    "billing/bill-drafts/not-a-uuid",
    "billing/bill-drafts/"+draft+"/transactions",
    "billing/bill-drafts/"+draft+"/void",
    "billing/bill-drafts/"+draft+"/items/../../void",
    "billing/bill-drafts/center/"+draft+"/issue",
    "billing/bill-drafts/"+draft+"/issue/"+line,
  ])for(const method of ["GET","POST","PATCH","PUT","DELETE"])assert.equal(billMethodAllowed(path,method),false,path+" "+method);
});

test("PAP-1504: Bill Table query is legal for a billing.view Manager without widening permissions",()=>{
  const declared=billSchema.table.columns.map(column=>column.field);
  assert.deepEqual(new Set(billQuery.order),new Set(declared));
  assert.equal(billQuery.order.length,declared.length);
  assert.ok(billQuery.visible.every(field=>declared.includes(field)));
  const scope={surface:"BO" as const,centerId:draft,authorize:(permission:string)=>["team.bo.access","billing.view"].includes(permission)};
  const bridged=toLegacyTableState(billSchema,billQuery,scope);
  assert.deepEqual(bridged.order,billQuery.order);
  assert.deepEqual(billSchema.detail.businessTabs.map(tab=>tab.id),["subscriptions","payments"]);
});

// PAP-1421 / PAP-1362: approved picker identifies Student, program and one price only.
test("PAP-1421 Subscription picker label has a monetary suffix but no opaque ID",()=>{
 const choice={studentDisplayName:"Bạn An",pathDisplayName:"Hành Trình",listPriceMinor:3900000};
 const label=billSubscriptionChoiceLabel(choice);
 assert.equal(label,"Bạn An · Hành Trình · 3.900.000 ₫");
 assert.equal((label.match(/₫/g)||[]).length,1);
 assert.doesNotMatch(label,/01900000-0000-7000-8000-000000000001/);
 assert.equal(billSubscriptionChoiceLabel({...choice,listPriceMinor:null}),"Bạn An · Hành Trình");
 assert.equal(billSubscriptionChoiceLabel({...choice,listPriceMinor:0}),"Bạn An · Hành Trình · 0 ₫");
 const editor=readFileSync("app/bo/bills/BillDraftEditor.tsx","utf8");
 assert.ok(editor.includes("{billSubscriptionChoiceLabel(s)}"));
 assert.ok(!editor.includes("{s.studentDisplayName} ₫") && !editor.includes("{s.pathDisplayName} ₫"));
});
