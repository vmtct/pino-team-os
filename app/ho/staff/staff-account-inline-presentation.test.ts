import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {StaffAccessPresentation} from "./StaffAccessPresentation";
import type {Snapshot} from "./staff-access-presentation-model";
const base:Snapshot={staffId:"STAFF-MOCK-001",accountId:null,accountStatus:"missing",employment:"inactive",revision:1,affiliationIds:["m1"],assignments:[]};
const centers=[{id:"m1",label:"M1",active:true}];
test("PAP-2423 PAP-784 missing or unknown account never fabricates an editable linked record",()=>{
 for(const snapshot of [base,{...base,accountStatus:"unknown" as const,accountId:"receipt"}]){
  const html=renderToStaticMarkup(createElement(StaffAccessPresentation,{snapshot,centers,roles:[],loginEmail:null,persist:()=>true}));
  assert.doesNotMatch(html,/data-staff-account-lifecycle-sample|data-staff-security-sample/);
  assert.match(html,/data-pds-field="accountStatus"/);
 }
});
test("PAP-2423 PAP-784 linked selected fixture has one account/email section and keeps inactive employment",()=>{
 const snapshot:Snapshot={...base,accountId:"M1-HYPOTHETICAL-ACCOUNT:"+base.staffId,accountStatus:"inactive"};
 const html=renderToStaticMarkup(createElement(StaffAccessPresentation,{snapshot,centers,roles:[],loginEmail:"staff@example.invalid",persist:()=>true}));
 assert.match(html,/data-staff-account-lifecycle-sample/);
 for(const key of ["accountStatus","loginEmail","employment"])assert.equal((html.match(new RegExp('data-pds-field="'+key+'"',"g"))??[]).length,1);
 assert.match(html,/data-pds-field="role"[\s\S]*?data-readonly="true"/);
 assert.doesNotMatch(html,/data-staff-security-sample/);
});
