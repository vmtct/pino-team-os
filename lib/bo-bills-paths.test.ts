import assert from "node:assert/strict";
import test from "node:test";
import {billMethodAllowed,isBoBillsPath} from "./bo-bills-paths";

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
