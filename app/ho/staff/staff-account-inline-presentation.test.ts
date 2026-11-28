import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {StaffAccessPresentation} from "./StaffAccessPresentation";
test("PAP-784 actual record remains readonly; hypothetical status and email are editable in native PDS",()=>{
 const html=renderToStaticMarkup(createElement(StaffAccessPresentation,{snapshot:{staffId:"STAFF-MOCK-001",accountId:null,accountStatus:"missing",employment:"inactive",revision:1,affiliationIds:["m1"],assignments:[]},centers:[{id:"m1",label:"M1",active:true}],roles:[],loginEmail:null}));
 const [actual,local]=html.split("data-staff-account-lifecycle-sample");
 assert.ok(local);
 assert.doesNotMatch(html,/data-staff-security-sample/);
 for(const key of ["accountStatus","loginEmail"]){assert.match(actual!,new RegExp('data-pds-field="'+key+'"[\\s\\S]*?data-readonly="true"'));assert.match(local,new RegExp('data-pds-field="'+key+'"[\\s\\S]*?<button[^>]*pds-property-value'));}
 assert.match(local,/data-pds-field="role"[\s\S]*?data-readonly="true"/);
});
